import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config";

export type JwtPayload = {
  sub: string;
  email: string;
};

function getJwtSecret(): string {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET 未配置");
  }
  return config.jwtSecret;
}

export function signAuthToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyAuthToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("无效 token");
  }

  const sub = decoded.sub;
  const email = (decoded as { email?: unknown }).email;
  if (typeof sub !== "string" || typeof email !== "string") {
    throw new Error("无效 token payload");
  }

  return { sub, email };
}
