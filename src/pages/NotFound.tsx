import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="mx-auto mt-8 flex w-full max-w-lg flex-col gap-2 rounded-xl border border-border/70 bg-card/70 p-8 shadow-sm">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you requested doesn’t exist.
      </p>
      <Link className="text-sm underline" to="/">
        Go home
      </Link>
    </div>
  );
}
