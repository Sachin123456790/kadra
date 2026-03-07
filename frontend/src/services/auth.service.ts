import { get, post } from './api-client';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  fullName?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  user: AuthUser;
}

export interface SignupRequest {
  email: string;
  password: string;
  fullName?: string;
  role?: 'admin' | 'platform_admin' | 'fund_admin' | 'operations_analyst' | 'investor';
  adminSignupSecret?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export async function signup(request: SignupRequest) {
  return post<AuthSession>('/auth/signup', request);
}

export async function login(request: LoginRequest) {
  return post<AuthSession>('/auth/login', request);
}

export async function getCurrentUser() {
  return get<AuthUser>('/auth/me');
}
