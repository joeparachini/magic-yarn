import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-2 p-8">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-neutral-600">The page you requested doesn’t exist.</p>
      <Link className="text-sm underline" to="/">
        Go home
      </Link>
    </div>
  )
}
