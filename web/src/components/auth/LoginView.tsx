import { FormEvent, useState } from "react";

interface LoginViewProps {
  isLoading: boolean;
  error: string | null;
  onLogin: (account: string, password: string) => void;
}

export function LoginView({ isLoading, error, onLogin }: LoginViewProps) {
  const [account, setAccount] = useState("kechen");
  const [password, setPassword] = useState("qwe123");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    onLogin(account, password);
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-neutral-950 px-4 py-10 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur"
      >
        <div className="mb-6">
          <div className="mb-2 text-sm font-medium text-neutral-400">Agent Runtime</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">登录工作台</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            使用已初始化的本地账号登录后，聊天请求会自动携带 JWT。
          </p>
        </div>

        <label className="mb-4 block">
          <span className="mb-2 block text-sm font-medium text-neutral-300">账号</span>
          <input
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            autoComplete="username"
            className="h-11 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-white/30 focus:ring-2 focus:ring-white/10"
            placeholder="kechen"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-2 block text-sm font-medium text-neutral-300">密码</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            className="h-11 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-white/30 focus:ring-2 focus:ring-white/10"
            placeholder="qwe123"
          />
        </label>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !account.trim() || !password}
          className="flex h-11 w-full items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
