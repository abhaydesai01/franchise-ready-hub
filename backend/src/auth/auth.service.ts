import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<ReturnType<UsersService['toSafeUser']>> {
    const userDoc = await this.usersService.findByEmail(email);
    if (!userDoc) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await this.usersService.validatePassword(userDoc, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const safeUser = this.usersService.toSafeUser(userDoc);
    await this.usersService.setLastLogin(String(userDoc._id), new Date());
    return safeUser;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    const payload = {
      sub: user._id,
      role: user.role,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: (this.configService.get<string>('jwt.accessTokenTtl') ??
        '15m') as any,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: (this.configService.get<string>('jwt.refreshTokenTtl') ??
        '7d') as any,
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  }
}
