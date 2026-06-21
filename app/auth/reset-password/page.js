import { PasswordResetForm } from "@/components/password-reset-form";
import { getPostLoginNextPath } from "@/lib/auth/password-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resetare parola | Nota 5+"
};

export default async function ResetPasswordPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const errorLabels = {
    password_invalid: "Parola trebuie sa aiba cel putin 8 caractere, iar confirmarile trebuie sa coincida.",
    reset_failed: "Nu am putut schimba parola. Cere un link nou si incearca din nou."
  };
  const error = typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : "";
  const nextPath = getPostLoginNextPath(resolvedSearchParams?.next);

  return (
    <main className="nota5plus-page auth-password-page">
      <PasswordResetForm errorMessage={errorLabels[error] || ""} nextPath={nextPath} />
    </main>
  );
}
