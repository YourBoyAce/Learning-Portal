export function getPasswordValidationErrors(password: string) {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include one uppercase letter.");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must include one lowercase letter.");
  }
  if (!/\d/.test(password)) {
    errors.push("Password must include one number.");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include one special character.");
  }

  return errors;
}

