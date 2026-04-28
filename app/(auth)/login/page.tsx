import { signIn, signUp } from "./actions";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Condo Search</h1>
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="w-full border rounded px-3 py-2"
        />
        <div className="flex gap-2">
          <button
            formAction={signIn}
            className="flex-1 bg-black text-white rounded py-2"
          >
            Sign in
          </button>
          <button
            formAction={signUp}
            className="flex-1 border rounded py-2"
          >
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}
