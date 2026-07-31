import { ApiError } from "./api";

function getErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message.trim().toLowerCase();
  }
  if (error instanceof Error) {
    return error.message.trim().toLowerCase();
  }
  return "";
}

export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return "Login failed. Check your email and password.";
  }

  return "Login failed. Please try again.";
}

export function getRegisterErrorMessage(error: unknown): string {
  const errorText = getErrorText(error);

  if (errorText.includes("email is already registered")) {
    return "Registration failed. Email already in use.";
  }
  if (errorText.includes("username is already taken")) {
    return "Registration failed. Username is unavailable.";
  }
  if (errorText.includes("between 3 and 32 characters")) {
    return "Registration failed. Username must be 3-32 characters.";
  }
  if (errorText.includes("only contain letters, numbers, underscore, and hyphen")) {
    return "Registration failed. Use letters, numbers, `_` or `-` in the username.";
  }
  if (errorText.includes("password must be at least 8 characters")) {
    return "Registration failed. Password must be at least 8 characters.";
  }
  if (errorText.includes("string should have at least 8 characters")) {
    return "Registration failed. Password must be at least 8 characters.";
  }
  if (errorText.includes("string should have at most 128 characters")) {
    return "Registration failed. Password must be 128 characters or fewer.";
  }
  if (errorText.includes("valid email")) {
    return "Registration failed. Enter a valid email.";
  }

  return "Registration failed. Please check your details and try again.";
}
