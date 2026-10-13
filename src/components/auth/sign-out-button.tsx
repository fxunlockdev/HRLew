import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";

interface Props {
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

/**
 * A plain form post rather than a client-side call: sign-out has to clear an
 * httpOnly cookie, which only the server can do.
 */
export function SignOutButton({ variant = "outline", className }: Props) {
  return (
    <form action={signOut}>
      <Button type="submit" variant={variant} className={className}>
        Sign out
      </Button>
    </form>
  );
}
