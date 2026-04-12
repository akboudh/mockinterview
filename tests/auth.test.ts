import { authenticateUser, createUserAccount, hashPassword, verifyPassword } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { resetDb } from "@/tests/test-utils";

describe("auth", () => {
  const originalMentorSignupCode = process.env.MENTOR_SIGNUP_CODE;
  const originalMentorEmails = process.env.MENTOR_EMAILS;
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(async () => {
    await resetDb();
    process.env.MENTOR_SIGNUP_CODE = "mentor-dev-access";
    process.env.MENTOR_EMAILS = "";
    process.env.ADMIN_EMAILS = "";
  });

  afterEach(() => {
    process.env.MENTOR_SIGNUP_CODE = originalMentorSignupCode;
    process.env.MENTOR_EMAILS = originalMentorEmails;
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it("hashes and verifies passwords securely", async () => {
    const passwordHash = await hashPassword("strong-password-123");

    expect(passwordHash).not.toContain("strong-password-123");
    await expect(verifyPassword("strong-password-123", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });

  it("creates and authenticates a local account", async () => {
    const user = await createUserAccount({
      email: "student@example.com",
      password: "strong-password-123",
      displayName: "Student"
    });

    const authenticated = await authenticateUser({
      email: "student@example.com",
      password: "strong-password-123"
    });
    const db = await readDb();
    const storedUser = db.users.find((entry) => entry.user_id === user.user_id);

    expect(authenticated.user_id).toBe(user.user_id);
    expect(storedUser?.password_hash).toBeTruthy();
    expect(storedUser?.password_hash).not.toBe("strong-password-123");
  });

  it("creates a mentor account when the shared mentor access code is provided", async () => {
    const user = await createUserAccount({
      email: "mentor@example.com",
      password: "strong-password-123",
      displayName: "Mentor",
      requestedRole: "mentor",
      mentorAccessCode: "mentor-dev-access"
    });

    expect(user.roles).toContain("mentor");
  });

  it("rejects mentor signup without an approved email or access code", async () => {
    await expect(
      createUserAccount({
        email: "mentor@example.com",
        password: "strong-password-123",
        displayName: "Mentor",
        requestedRole: "mentor"
      })
    ).rejects.toMatchObject({
      message: "Mentor signup requires an approved mentor email or access code."
    });
  });
});
