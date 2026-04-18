import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(
    id: string,
  ): Promise<Omit<User & { _id: string }, 'passwordHash'>> {
    const user = await this.userModel
      .findById(id)
      .lean<(User & { _id: string }) | null>()
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async listAdminAndManagerEmails(): Promise<string[]> {
    const rows = await this.userModel
      .find({ role: { $in: ['admin', 'manager'] } })
      .select('email')
      .lean<Array<{ email: string }>>()
      .exec();
    return rows.map((r) => r.email);
  }

  async getEmailById(id: string): Promise<string | null> {
    const u = await this.userModel
      .findById(id)
      .select('email')
      .lean<{ email?: string } | null>()
      .exec();
    return u?.email ?? null;
  }

  async create(
    dto: CreateUserDto,
  ): Promise<Omit<User & { _id: string }, 'passwordHash'>> {
    const existing = await this.userModel.exists({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const created = await this.userModel.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role ?? 'rep',
    });

    return this.toSafeUser(created);
  }

  async invite(
    dto: InviteUserDto,
  ): Promise<Omit<User & { _id: string }, 'passwordHash'>> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.exists({ email });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const inferredName =
      dto.name?.trim() ||
      email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

    const tempPassword = `Temp@${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await this.hashPassword(tempPassword);

    const created = await this.userModel.create({
      email,
      passwordHash,
      name: inferredName,
      role: dto.role ?? 'rep',
    });

    return this.toSafeUser(created);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
  ): Promise<Omit<User & { _id: string }, 'passwordHash'>> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            ...(dto.name ? { name: dto.name } : {}),
            ...(dto.role ? { role: dto.role } : {}),
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(updated);
  }

  async list(): Promise<Array<Omit<User & { _id: string }, 'passwordHash'>>> {
    const users = await this.userModel
      .find()
      .lean<Array<User & { _id: string }>>()
      .exec();
    return users.map((u) => this.toSafeUser(u)) as Array<
      Omit<User & { _id: string }, 'passwordHash'>
    >;
  }

  async remove(id: string): Promise<{ ok: true }> {
    const deleted = await this.userModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('User not found');
    }
    return { ok: true };
  }

  async setLastLogin(userId: string, at: Date) {
    await this.userModel
      .findByIdAndUpdate(userId, { $set: { lastLoginAt: at } })
      .exec();
  }

  async ensureAdminSeed() {
    const admin = await this.userModel.findOne({ role: 'admin' }).exec();
    if (admin) return;

    const email = 'admin@franchiseready.local';
    const passwordHash = await this.hashPassword('Admin123!');

    await this.userModel.create({
      email,
      passwordHash,
      name: 'Admin',
      role: 'admin',
    });
  }

  async validatePassword(user: UserDocument, password: string) {
    return bcrypt.compare(password, user.passwordHash);
  }

  toSafeUser(user: User | UserDocument | (User & { _id: string })) {
    const doc = user as UserDocument;
    const plain =
      typeof doc.toObject === 'function'
        ? (doc.toObject() as User & { _id: string })
        : (user as User & { _id: string });
    const { passwordHash: _passwordHash, ...rest } = plain;
    void _passwordHash;
    return rest;
  }

  private async hashPassword(password: string) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}
