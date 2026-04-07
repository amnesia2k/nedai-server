import { ApiError } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import { issueAccessToken } from "@/lib/auth-token";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/api/v1/app/schemas/auth.schema";
import {
  changePasswordSchema,
  updateCurrentUserSchema,
  type UpdateCurrentUserInput,
} from "@/api/v1/app/schemas/user.schema";
import { serializeUser } from "@/api/v1/serializers/user.serializer";
import type { User } from "@prisma/client";

export class AuthServiceImpl {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  public async register(payload: unknown) {
    const data = registerSchema.parse(payload);
    await this.assertEmailAvailable(data.email);

    const passwordHash = await Bun.password.hash(data.password);
    const user = await this.prismaClient.user.create({
      data: {
        fullName: data.name,
        email: data.email,
        passwordHash,
      },
    });

    const accessToken = await issueAccessToken(user);

    return {
      accessToken,
      user: serializeUser(user),
    };
  }

  public async login(payload: unknown) {
    const data = loginSchema.parse(payload);
    const user = await this.prismaClient.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const isPasswordValid = await Bun.password.verify(
      data.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const accessToken = await issueAccessToken(user);

    return {
      accessToken,
      user: serializeUser(user),
    };
  }

  public async getCurrentUser(userId: string) {
    const user = await this.getRequiredUser(userId);
    return serializeUser(user);
  }

  public async updateCurrentUser(userId: string, payload: unknown) {
    await this.getRequiredUser(userId);

    const data = updateCurrentUserSchema.parse(payload);
    const updateData = this.buildCurrentUserUpdateData(data);
    const user = await this.prismaClient.user.update({
      where: {
        id: userId,
      },
      data: updateData,
    });

    return serializeUser(user);
  }

  public async changeCurrentPassword(userId: string, payload: unknown) {
    const user = await this.getRequiredUser(userId);
    const data = changePasswordSchema.parse(payload);

    const isPasswordValid = await Bun.password.verify(
      data.oldPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new ApiError(400, "Current password is incorrect");
    }

    const passwordHash = await Bun.password.hash(data.newPassword);

    await this.prismaClient.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash,
      },
    });
  }

  private async assertEmailAvailable(
    email: RegisterInput["email"] | LoginInput["email"],
  ) {
    const existingUser = await this.prismaClient.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ApiError(409, "An account with this email already exists");
    }
  }

  private buildCurrentUserUpdateData(data: UpdateCurrentUserInput) {
    const updateData: {
      fullName?: string;
    } = {};

    if (data.name !== undefined) {
      updateData.fullName = data.name;
    }

    return updateData;
  }

  private async getRequiredUser(userId: string): Promise<User> {
    const user = await this.prismaClient.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }

    return user;
  }
}

const AuthService = new AuthServiceImpl();

export default AuthService;
