import { ApiError } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import { issueAccessToken } from "@/lib/auth-token";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/api/v1/app/schemas/auth.schema";
import { serializeUser } from "@/api/v1/serializers/user.serializer";

class AuthServiceImpl {
  public async register(payload: unknown) {
    const data = registerSchema.parse(payload);
    await this.assertEmailAvailable(data.email);

    const passwordHash = await Bun.password.hash(data.password);
    const user = await prisma.user.create({
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
    const user = await prisma.user.findUnique({
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
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }

    return serializeUser(user);
  }

  private async assertEmailAvailable(
    email: RegisterInput["email"] | LoginInput["email"],
  ) {
    const existingUser = await prisma.user.findUnique({
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
}

const AuthService = new AuthServiceImpl();

export default AuthService;
