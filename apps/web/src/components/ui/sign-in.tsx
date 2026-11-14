'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, type LucideIcon } from 'lucide-react';

export interface Highlight {
  icon: LucideIcon;
  title: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  highlights?: Highlight[];
  error?: string | null;
  loading?: boolean;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignIn: (event: React.FormEvent<HTMLFormElement>) => void;
}

const InputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-input bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
    {children}
  </div>
);

const HighlightCard = ({
  highlight,
  delay,
  floatDelay = '',
}: {
  highlight: Highlight;
  delay: string;
  floatDelay?: string;
}) => {
  const Icon = highlight.icon;
  return (
    <div className={`animate-testimonial ${delay}`}>
      <div
        className={`animate-float ${floatDelay} flex w-56 items-start gap-3 rounded-2xl border border-white/15 bg-zinc-900/70 p-4 backdrop-blur-xl`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="text-xs leading-snug text-white">
          <p className="text-sm font-semibold">{highlight.title}</p>
          <p className="mt-1 text-white/70">{highlight.text}</p>
        </div>
      </div>
    </div>
  );
};

export const SignInPage: React.FC<SignInPageProps> = ({
  title = 'Bem-vindo!',
  description = 'Entre com seus dados para acessar o painel',
  highlights = [],
  error,
  loading = false,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSignIn,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex h-[100dvh] w-[100dvw] flex-col md:flex-row">
      {/* Coluna esquerda: formulário */}
      <section className="flex flex-1 items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm">
          <div className="flex flex-col">
            <div className="animate-element animate-delay-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              <span className="text-lg font-bold text-primary">Segurança em 360</span>
            </div>

            <h1 className="animate-element animate-delay-200 mt-10 text-2xl font-bold text-foreground">
              {title}
            </h1>
            <p className="animate-element animate-delay-300 mt-1 text-sm text-muted-foreground">
              {description}
            </p>

            <form className="mt-8 space-y-4" onSubmit={onSignIn} autoComplete="on" noValidate>
              <div className="animate-element animate-delay-400 space-y-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-foreground">
                  E-mail
                </label>
                <InputWrapper>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="seu@empresa.com.br"
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    className="h-10 w-full rounded-lg bg-transparent px-3 text-sm focus:outline-none"
                  />
                </InputWrapper>
              </div>

              <div className="animate-element animate-delay-500 space-y-1.5">
                <label htmlFor="password" className="text-sm font-semibold text-foreground">
                  Senha
                </label>
                <InputWrapper>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      className="h-10 w-full rounded-lg bg-transparent px-3 pr-10 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute inset-y-0 right-3 flex items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </InputWrapper>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="animate-element animate-delay-600 mt-2 h-11 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="animate-element animate-delay-700 mt-8 text-center text-sm text-muted-foreground">
              Sem conta? <span className="font-semibold text-foreground">Solicite a um administrador.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Coluna direita: painel da marca (escudo + radar) */}
      <section className="relative hidden flex-1 md:block">
        <div className="animate-slide-right animate-delay-300 absolute inset-0 overflow-hidden bg-zinc-950">
          {/* grade industrial de fundo */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          {/* glow laranja central */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl"
          />

          {/* linhas conectando escudo aos cards */}
          {highlights.length > 0 && (
            <svg
              aria-hidden
              className="absolute inset-0 hidden h-full w-full lg:block"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <line
                x1="50" y1="44" x2="22" y2="22"
                className="animate-dash-flow stroke-primary/50"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                vectorEffect="non-scaling-stroke"
              />
              {highlights[1] && (
                <line
                  x1="50" y1="44" x2="80" y2="48"
                  className="animate-dash-flow stroke-primary/50 [animation-delay:0.5s]"
                  strokeWidth="1.5"
                  strokeDasharray="6 6"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {highlights[2] && (
                <line
                  x1="50" y1="44" x2="26" y2="76"
                  className="animate-dash-flow stroke-primary/50 [animation-delay:1s]"
                  strokeWidth="1.5"
                  strokeDasharray="6 6"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          )}

          {/* escudo central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8">
            <div className="animate-float relative flex items-center justify-center">
              {/* anéis de radar */}
              <span
                aria-hidden
                className="absolute h-44 w-44 rounded-full border border-primary/35 animate-ping [animation-duration:3s]"
              />
              <span
                aria-hidden
                className="absolute h-60 w-60 rounded-full border border-primary/25 animate-ping [animation-duration:3s] [animation-delay:1.5s]"
              />
              <div className="animate-shield-glow flex h-28 w-28 items-center justify-center rounded-3xl border border-primary/40 bg-primary/15">
                <ShieldCheck className="animate-shield-beat h-14 w-14 text-primary" aria-hidden />
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold tracking-tight text-white">
                Segurança em 360
              </p>
              <p className="mt-2 text-sm text-white/60">
                Checklists, alertas e equipes monitorados em tempo real.
              </p>
            </div>
          </div>

          {/* cards satélites */}
          {highlights.length > 0 && (
            <>
              <div className="absolute left-[5%] top-[10%] hidden lg:block">
                <HighlightCard highlight={highlights[0]} delay="animate-delay-1000" />
              </div>
              {highlights[1] && (
                <div className="absolute right-[4%] top-[40%] hidden lg:block">
                  <HighlightCard
                    highlight={highlights[1]}
                    delay="animate-delay-1200"
                    floatDelay="animation-delay-2000"
                  />
                </div>
              )}
              {highlights[2] && (
                <div className="absolute bottom-[8%] left-[9%] hidden lg:block">
                  <HighlightCard
                    highlight={highlights[2]}
                    delay="animate-delay-1400"
                    floatDelay="animation-delay-4000"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};
