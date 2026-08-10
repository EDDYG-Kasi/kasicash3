export interface AuthPrincipalContext {
  principalId: string;
  email: string;
  businessId: string;
  currency: string;
  timezone: string;
}

export interface AuthLoginBody {
  email?: unknown;
  password?: unknown;
}

export interface AuthLoginResponseDto {
  token: string;
  expiresAt: string;
  principal: AuthPrincipalContext;
}

export interface AuthMeResponseDto {
  principal: AuthPrincipalContext;
}
