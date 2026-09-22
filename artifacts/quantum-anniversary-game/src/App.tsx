import { type CSSProperties, type FormEvent, type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Copy,
  Mail,
  MoveHorizontal,
  Phone,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { completeCampaign, lookupCampaign } from '@workspace/api-client-react';

const queryClient = new QueryClient();
const STORAGE_KEY = 'quantum-hoops-anniversary-session';
const HOOP_REWARDS = [12, 15, 18, 20] as const;
const HOOP_POSITIONS = [.13, .375, .62, .86] as const;
const MAX_SHOTS = 3;

type Entry = { name: string; email: string; phone: string };
type ShotResult = number | null;
type Session = {
  phase: 'entry' | 'game' | 'claiming' | 'result';
  entry: Entry | null;
  shots: ShotResult[];
  best: number;
  timestamp: string;
  hoopRewards: number[];
  couponCode: string | null;
  campaignCompleted: boolean;
};

function shuffleRewards(previous?: number[]) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const values = [...HOOP_REWARDS];
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    const staysPut = previous?.some((value, index) => values[index] === value);
    if (!staysPut) return values;
  }
  if (previous && previous.length === HOOP_REWARDS.length) {
    return previous.map((_, index) => previous[(index + 1) % previous.length]!);
  }
  return [...HOOP_REWARDS];
}

function isCurrentRewardSet(rewards: number[] | undefined) {
  if (!rewards || rewards.length !== HOOP_POSITIONS.length) return false;
  const expected = [...HOOP_REWARDS].sort((a, b) => a - b);
  const actual = [...rewards].sort((a, b) => a - b);
  return expected.every((value, index) => value === actual[index]);
}

function useVisualViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    function sync() {
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty('--app-height', `${Math.round(height)}px`);
    }

    sync();
    viewport?.addEventListener('resize', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      viewport?.removeEventListener('resize', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);
}

function isDeviceLandscape() {
  const type = window.screen?.orientation?.type;
  if (typeof type === 'string') return type.startsWith('landscape');
  if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90;
  return false;
}

function isPhoneOrTablet() {
  return window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(max-width: 1024px)').matches;
}

function useLandscapePhoneOrTablet() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function update() {
      // Use the device sensor orientation, not CSS viewport size. Opening the
      // keyboard shrinks height so width > height and matchMedia(landscape)
      // can fire while the phone is still in portrait.
      setShow(isDeviceLandscape() && isPhoneOrTablet());
    }

    update();
    window.screen?.orientation?.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.screen?.orientation?.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return show;
}

function PortraitOverlay() {
  return (
    <div
      aria-live="polite"
      className="pointer-events-auto fixed inset-0 z-[80] grid place-items-center bg-[#1f1f1f] px-6 text-center text-[#fbfbfb]"
      data-testid="overlay-portrait"
      role="dialog"
      aria-labelledby="portrait-heading"
      aria-modal="true"
    >
      <div className="flex max-w-sm flex-col items-center">
        <svg aria-hidden="true" className="device-to-portrait h-28 w-28" fill="none" viewBox="0 0 80 120">
          <rect height="112" rx="14" stroke="#ea078c" strokeWidth="4" width="64" x="8" y="4" />
          <rect fill="#685bc7" height="6" rx="3" width="22" x="29" y="12" />
          <circle cx="40" cy="104" fill="#685bc7" r="5" />
        </svg>
        <h2 className="display-font mt-8 text-4xl font-black uppercase leading-none" id="portrait-heading">Turn your device</h2>
        <p className="mt-4 text-sm font-medium leading-6 text-[#dfdfdf]">This game is best played in portrait. Rotate your phone or tablet to continue.</p>
      </div>
    </div>
  );
}

function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch {
    return null;
  }
}

function Logo() {
  return (
    <div className="flex items-center" data-testid="brand-quantum">
      <img
        alt="Quantum Fitness"
        className="h-10 w-auto rounded-md bg-[#ffffff] object-contain p-2.5 py-1.5 sm:h-11 sm:p-3 sm:py-2"
        src={`${import.meta.env.BASE_URL}quantum-fitness-logo.webp`}
      />
    </div>
  );
}

function BrandMark() {
  return (
    <img
      alt="Quantum Fitness"
      className="h-11 w-auto rounded-md bg-[#ffffff] object-contain p-3 py-2 sm:h-11"
      src={`${import.meta.env.BASE_URL}quantum-fitness-logo.webp`}
    />
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
  error,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  icon: ReactNode;
  error?: string;
  testId: string;
}) {
  return (
    <label className="block w-full">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.16em] text-[#3f3f3f]">{label}</span>
      <span className={`flex w-full items-center gap-3 rounded-xl border bg-[#ffffff] px-3.5 transition-colors ${error ? 'border-[#e9002b]' : 'border-[#e0d9dd] focus-within:border-[#685bc7]'}`}>
        <span className="shrink-0 text-[#685bc7]">{icon}</span>
        <input
          aria-invalid={Boolean(error)}
          className="h-12 w-full min-w-0 flex-1 bg-transparent text-base font-medium text-[#191919] outline-none placeholder:text-[#9a9398]"
          data-testid={testId}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      </span>
      {error ? <span className="mt-1.5 block text-xs font-semibold text-[#e9002b]" data-testid={`${testId}-error`}>{error}</span> : null}
    </label>
  );
}

function claimErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message) return data.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

function EntryScreen({ onStart }: { onStart: (entry: Entry) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [existingCoupon, setExistingCoupon] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  function changeEmail(value: string) {
    setEmail(value);
    setExistingCoupon(undefined);
    setLookupError(null);
    setCopied(false);
  }

  function resetForm() {
    setName('');
    setEmail('');
    setPhone('');
    setErrors({});
    setLookupError(null);
    setExistingCoupon(undefined);
    setCopied(false);
  }

  async function copyExistingCoupon() {
    if (!existingCoupon) return;
    try {
      await navigator.clipboard.writeText(existingCoupon);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Tell us your name to join the game.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!/^[+()\d\s-]{7,}$/.test(phone.trim())) next.phone = 'Enter a valid phone number.';
    setErrors(next);
    setLookupError(null);
    if (Object.keys(next).length > 0) return;

    setChecking(true);
    try {
      const result = await lookupCampaign({ email: email.trim() });
      if (result.exists) {
        setExistingCoupon(result.couponCode);
        return;
      }
      setExistingCoupon(undefined);
      onStart({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    } catch (error: unknown) {
      setLookupError(claimErrorMessage(error));
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="entry-screen relative overflow-x-clip bg-[#1f1f1f] text-[#fbfbfb]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#685bc7] opacity-80" />
      <div className="pointer-events-none absolute bottom-[-170px] left-[-100px] h-96 w-96 rounded-full border-[42px] border-[#685bc7]/10" />
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8 sm:py-5 lg:px-12">
        <Logo />
        <div className="flex items-center gap-2 text-right">
          <span className="hidden text-[10px] font-bold uppercase tracking-[.2em] text-[#dfdfdf] sm:inline">Celebrating</span>
          <span className="display-font text-base font-black text-[#ea078c] sm:text-xl">28 YEARS</span>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-7xl items-start gap-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 sm:items-center sm:gap-12 sm:px-8 sm:pb-10 sm:pt-8 lg:grid-cols-[1.12fr_.88fr] lg:gap-20 lg:px-12 lg:pb-24 lg:pt-20">
        <section className="animate-enter-up text-center lg:text-left">
          <div className="mb-2 flex items-center gap-3 justify-center sm:mb-6 lg:justify-start">
            <span className="h-px w-8 bg-[#ea078c] sm:w-10" />
            <span className="text-[10px] font-bold uppercase tracking-[.24em] text-[#ea078c] sm:text-[11px]">Quantum anniversary game</span>
          </div>
          <h1 className="entry-title display-font mx-auto max-w-[700px] text-[36px] font-black uppercase leading-[.92] tracking-[-.045em] lg:mx-0 lg:text-[clamp(4rem,10vw,6rem)] lg:leading-[1]">
            Take your<br /><span className="text-[#ea078c]">best shot.</span>
          </h1>
          <aside className="entry-terms mx-auto mt-3 max-w-lg rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left sm:mt-6 sm:px-5 sm:py-4 lg:mx-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ea078c] sm:text-[11px]">
              Terms and Conditions
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-4 text-[11px] leading-5 text-[#dfdfdf] sm:text-xs sm:leading-5">
              <li>Game-related offers and promotions cannot be combined with any other ongoing offers, promotions, or discounts.</li>
              <li>However, an additional discount may be applied where specifically stated or permitted by the promotion.</li>
              <li>The company reserves the right to determine the eligibility and applicability of discounts and promotions.</li>
            </ul>
          </aside>
          <p className="entry-copy mx-auto mt-3 max-w-lg text-sm leading-6 text-[#dfdfdf] sm:mt-7 sm:text-lg sm:leading-7 lg:mx-0">
            Three throws. Four hoops. One reward to take home. Step up and shoot for a Quantum anniversary discount.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#dfdfdf] sm:mt-10 sm:gap-x-8 sm:gap-y-3 sm:text-xs lg:justify-start">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ea078c]" /> 3 chances</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#685bc7]" /> up to 20% off</span>
          </div>
        </section>

        <section className="animate-enter-right relative mx-auto w-full min-w-0 max-w-[470px]">
          <div className="absolute -right-2 -top-8 z-10 grid h-14 w-14 rotate-6 place-items-center rounded-full bg-[#685bc7] text-center text-white shadow-[4px_5px_0_#121212] sm:-right-3 sm:-top-14 sm:h-20 sm:w-20">
            <span className="display-font text-[13px] font-black leading-[.8] sm:text-[21px]">WIN<br />MORE</span>
          </div>
          <div className="entry-form-card rounded-[28px] border border-[#e0d9dd] bg-[#ffffff] p-5 shadow-[11px_12px_0_#121212] sm:p-8">
            <div className="mb-4 flex items-start justify-between sm:mb-7">
              <div>
                <p className="display-font text-[1.65rem] font-black uppercase leading-none text-[#3f3f3f] sm:text-3xl">Get on court</p>
                <p className="mt-2 text-sm text-[#3f3f3f]">Enter your details to unlock the game.</p>
              </div>
              <div className="rounded-full bg-[#fce4f2] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#685bc7]">Free to play</div>
            </div>
            <form className="w-full space-y-3 sm:space-y-4" onSubmit={submit}>
              <Field error={errors.name} icon={<UserRound size={17} />} label="Your name" onChange={setName} placeholder="e.g. Ayesha Perera" testId="input-player-name" value={name} />
              <Field error={errors.email} icon={<Mail size={17} />} label="Email address" onChange={changeEmail} placeholder="you@example.com" testId="input-player-email" type="email" value={email} />
              <Field error={errors.phone} icon={<Phone size={17} />} label="Phone number" onChange={setPhone} placeholder="+94 77 123 4567" testId="input-player-phone" type="tel" value={phone} />
              {lookupError ? (
                <p className="text-xs font-semibold text-[#e9002b]" data-testid="status-lookup-error">{lookupError}</p>
              ) : null}
              {existingCoupon !== undefined ? (
                <div className="rounded-xl border border-[#e0d9dd] bg-[#f7f5f6] px-4 py-4" data-testid="panel-returning-player">
                  <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#636464]">Already played</div>
                  <p className="mt-2 text-sm font-medium text-[#3f3f3f]">
                    {existingCoupon
                      ? 'This email already claimed an anniversary coupon. Use it at checkout.'
                      : 'This email already played the anniversary game.'}
                  </p>
                  {existingCoupon ? (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <code className="display-font text-2xl font-black tracking-[.08em] text-[#292929] uppercase" data-testid="text-existing-coupon">{existingCoupon}</code>
                      <button aria-label="Copy coupon code" className="grid h-9 w-9 place-items-center rounded-full border border-[#e0d9dd] text-[#685bc7] hover:bg-[#ffffff]" data-testid="button-copy-existing-coupon" onClick={copyExistingCoupon} type="button">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  ) : null}
                  <button
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e0d9dd] bg-[#ffffff] px-4 py-3 text-sm font-bold uppercase tracking-[.08em] text-[#3f3f3f] transition-colors hover:border-[#685bc7] hover:text-[#685bc7]"
                    data-testid="button-reset-entry"
                    onClick={resetForm}
                    type="button"
                  >
                    <RotateCcw size={16} /> Try another email
                  </button>
                </div>
              ) : (
                <button className="group mt-3 flex h-14 w-full items-center justify-between rounded-xl bg-[#ea078c] px-5 text-left text-[#ffffff] shadow-[0_5px_0_#d1067d] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:translate-y-0 disabled:opacity-70" data-testid="button-start-game" disabled={checking} type="submit">
                  <span>
                    <span className="block display-font text-xl font-black uppercase leading-none">{checking ? 'Checking…' : 'Enter the court'}</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[.15em] text-[#ffd0ea]">One coupon per email</span>
                  </span>
                  <ArrowRight className="transition-transform group-hover:translate-x-1" size={23} />
                </button>
              )}
            </form>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-center text-[10px] font-bold uppercase tracking-[.14em] text-[#dfdfdf]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#685bc7]" /> Quantum.lk anniversary celebration
          </div>
        </section>
      </div>
    </main>
  );
}

function Hoop({ index, active }: { index: number; active: boolean }) {
  const left = `${HOOP_POSITIONS[index] * 100}%`;
  return (
    <div className={`absolute top-[23%] -translate-x-1/2 transition-transform duration-300 ${active ? 'scale-110' : ''}`} style={{ left }} data-testid={`hoop-${index + 1}`}>
      <div className="relative h-[90px] w-[94px] sm:h-[175px] sm:w-[118px]">
        <img
          alt=""
          className="h-full w-full object-contain"
          draggable={false}
          src="/hoop.png"
        />
      </div>
    </div>
  );
}

function Basketball({ aiming, aim, shooting, shotStyle }: { aiming: boolean; aim: { x: number; y: number }; shooting: boolean; shotStyle?: CSSProperties }) {
  const pullX = aiming && !shooting ? (aim.x - .5) * 18 : 0;
  const pullY = aiming && !shooting ? (aim.y - .72) * 18 : 0;
  return (
    <div className="absolute bottom-[8%] left-1/2 z-20 h-14 w-14 -ml-7 transition-transform duration-150 sm:h-[90px] sm:w-[90px] sm:-ml-[35px]" style={{ transform: `translate3d(${pullX}px, ${pullY}px, 0)` }}>
      <div className={`relative h-full w-full overflow-hidden rounded-full ${shooting ? 'shot-animation' : 'animate-float-ball'}`} style={shotStyle}>
        <img
          alt=""
          className="h-full w-full rounded-full object-cover shadow-[4px_6px_0_rgba(27,27,27,.35)]"
          draggable={false}
          src="/basketball.png"
        />
      </div>
    </div>
  );
}

function Hand({ aiming }: { aiming: boolean }) {
  return (
    <div className={`absolute bottom-[-13px] left-1/2 z-10 h-[110px] w-[142px] -translate-x-1/2 transition-transform sm:h-[135px] sm:w-[174px] ${aiming ? 'scale-105' : ''}`}>
      <img
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
        src="/hands.png"
      />
    </div>
  );
}

function GameCourt({
  shots,
  hoopRewards,
  onShot,
}: {
  shots: ShotResult[];
  hoopRewards: number[];
  onShot: (target: ShotResult, shotStyle: CSSProperties) => void;
}) {
  const courtRef = useRef<HTMLDivElement>(null);
  const [aim, setAim] = useState({ x: .5, y: .52 });
  const [isAiming, setIsAiming] = useState(false);
  const [isShooting, setIsShooting] = useState(false);
  const [shotStyle, setShotStyle] = useState<CSSProperties>();
  const [activeHoop, setActiveHoop] = useState<number | null>(null);
  const [landed, setLanded] = useState<number | 'miss' | null>(null);

  function updateAim(clientX: number, clientY: number) {
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAim({
      x: Math.max(.04, Math.min(.96, (clientX - rect.left) / rect.width)),
      y: Math.max(.1, Math.min(.78, (clientY - rect.top) / rect.height)),
    });
  }

  function startAim(event: PointerEvent<HTMLDivElement>) {
    if (isShooting || shots.length >= MAX_SHOTS) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsAiming(true);
    updateAim(event.clientX, event.clientY);
  }

  function moveAim(event: PointerEvent<HTMLDivElement>) {
    if (isAiming && !isShooting) updateAim(event.clientX, event.clientY);
  }

  function endAim(event: PointerEvent<HTMLDivElement>) {
    if (!isAiming || isShooting) return;
    setIsAiming(false);
    const rect = courtRef.current?.getBoundingClientRect();
    const finalX = rect ? Math.max(.04, Math.min(.96, (event.clientX - rect.left) / rect.width)) : aim.x;
    const finalY = rect ? Math.max(.1, Math.min(.78, (event.clientY - rect.top) / rect.height)) : aim.y;
    setAim({ x: finalX, y: finalY });
    const target = HOOP_POSITIONS.reduce((bestIndex, _position, index) => {
      return Math.abs(HOOP_POSITIONS[index] - finalX) < Math.abs(HOOP_POSITIONS[bestIndex] - finalX) ? index : bestIndex;
    }, 0);
    const xDistance = Math.abs(HOOP_POSITIONS[target] - finalX);
    const yDistance = Math.abs(.31 - finalY);
    const hitHoop = xDistance <= .085 && yDistance <= .22;
    const style = {
      '--shot-x': `${(finalX - .5) * (rect?.width ?? 700)}px`,
      '--shot-rise': `-${(rect?.height ?? 560) * .63}px`,
      '--shot-drop': `-${(rect?.height ?? 560) * .53}px`,
      '--shot-end': `-${(rect?.height ?? 560) * .48}px`,
    } as CSSProperties;
    setActiveHoop(hitHoop ? target : null);
    setShotStyle(style);
    setIsShooting(true);
    window.setTimeout(() => {
      setLanded(hitHoop ? hoopRewards[target] : 'miss');
      setIsShooting(false);
      setShotStyle(undefined);
      setActiveHoop(null);
      onShot(hitHoop ? hoopRewards[target] : null, style);
      window.setTimeout(() => setLanded(null), 1800);
    }, 1080);
  }

  const pathEndX = aim.x * 100;
  const pathEndY = aim.y * 100;
  return (
    <div
      aria-label="Basketball court. Press and drag from the ball to aim, then release to shoot."
      className="court-grain relative h-full min-h-0 w-full touch-none overflow-hidden rounded-[24px] border-[3px] border-[#ffffff] bg-[#550333] shadow-[7px_8px_0_#ffffff] sm:rounded-[32px]"
      data-testid="game-court"
      onPointerDown={startAim}
      onPointerMove={moveAim}
      onPointerUp={endAim}
      ref={courtRef}
      role="application"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.96),rgba(10,10,10,0.96))]" />
      <div className="absolute inset-x-0 top-[14%] h-px bg-[#f5c4e0]/30" />
      {/* <div className="absolute left-1/2 top-[9%] h-[43%] w-[55%] -translate-x-1/2 rounded-[50%] border border-[#f5c4e0]/35" /> */}
      <div className="absolute left-1/2 top-[20%] h-[21%] w-[25%] -translate-x-1/2 border border-[#f5c4e0]/25" />
      <div className="absolute bottom-0 left-1/2 h-[18%] w-[68%] -translate-x-1/2 rounded-t-[50%] border-t-2 border-[#f5c4e0]/35" />
      <div className="absolute bottom-0 left-1/2 h-[7px] w-full -translate-x-1/2 bg-[#000000]" />
      <img
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-3/5 z-[1] w-[38%] max-w-[200px] -translate-x-1/2 -translate-y-1/2 opacity-20 mix-blend-lighten"
        src={`${import.meta.env.BASE_URL}qf-annivesary-logo.png`}
      />
      <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-[#ea078c]/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#fce4f2] sm:left-7 sm:top-7">
        <Target size={14} /> Aim and release
      </div>
      {HOOP_POSITIONS.map((_position, index) => <Hoop active={activeHoop === index} index={index} key={index} />)}
      <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[5] h-full w-full transition-opacity duration-200 ${isAiming ? 'opacity-100' : 'opacity-35'}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d={`M 50 82 Q 50 56 ${pathEndX} ${pathEndY}`} fill="none" pathLength="1" stroke="#ea078c" strokeDasharray="0.025 0.02" strokeLinecap="round" strokeWidth="0.7" />
        <circle cx={pathEndX} cy={pathEndY} fill="#ea078c" r={isAiming ? "1.6" : "1.15"} />
        <circle cx={pathEndX} cy={pathEndY} fill="none" opacity={isAiming ? ".75" : ".35"} r={isAiming ? "3.5" : "2.5"} stroke="#ea078c" strokeWidth=".45" />
      </svg>
      <div className={`absolute bottom-[18%] left-1/2 z-10 -translate-x-1/2 transition-opacity ${isAiming ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[#ffffff] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#000000]">
          <MoveHorizontal size={13} /> Hold · drag · release
        </div>
      </div>
      {/* <Hand aiming={isAiming} /> */}
      <Basketball aim={aim} aiming={isAiming} shotStyle={shotStyle} shooting={isShooting} />
      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[.15em] text-[#ffffff]/100 sm:bottom-4">
        {isShooting ? 'On its way...' : isAiming ? 'Guide the path to a hoop' : 'Hold the ball and drag'}
      </div>
      {landed !== null ? (
        <div className="animate-enter-up absolute left-1/2 top-[49%] z-30 -translate-x-1/2 rounded-2xl border-2 border-[#ffffff] bg-[#685bc7] px-5 py-3 text-center text-white shadow-[5px_5px_0_#ffffff]" data-testid="status-landed">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-white/80">{landed === 'miss' ? 'Just missed' : 'Reward unlocked'}</div>
          <div className="display-font text-4xl font-black leading-none">{landed === 'miss' ? 'No hoop' : `${landed}% OFF`}</div>
        </div>
      ) : null}
    </div>
  );
}

function Progress({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2" data-testid="status-attempts">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-[.15em] text-[#131212]">Shots</span>
      {[0, 1, 2].map((attempt) => (
        <span className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-black ${attempt < count ? 'border-[#ea078c] bg-[#ea078c] text-[#ffffff]' : 'border-[#d5cfd3] bg-transparent text-[#8a8388]'}`} data-testid={`attempt-${attempt + 1}`} key={attempt}>
          {attempt < count ? <Check size={15} strokeWidth={3} /> : attempt + 1}
        </span>
      ))}
    </div>
  );
}

function GameScreen({ entry, shots, best, hoopRewards, onShot, onRestart }: { entry: Entry; shots: ShotResult[]; best: number; hoopRewards: number[]; onShot: (reward: ShotResult) => void; onRestart: () => void }) {
  return (
    <main className="flex h-[var(--app-height,100svh)] flex-col overflow-hidden bg-[#1f1f1f] text-[#fbfbfb]">
      <header className="mx-auto flex w-full max-w-[1400px] shrink-0 items-center justify-between px-4 py-2.5 sm:px-8 sm:py-3 lg:px-12">
        <BrandMark />
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#dfdfdf]">Player</div><div className="text-sm font-bold">{entry.name}</div></div>
          <button aria-label="Start over with a new player" className="grid h-10 w-10 place-items-center rounded-full border border-[#e0d9dd] text-[#dfdfdf] transition-colors hover:bg-[#ffffff] hover:text-[#ea078c]" data-testid="button-restart-top" onClick={onRestart} type="button"><RotateCcw size={16} /></button>
        </div>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col px-4 pb-3 sm:px-8 lg:px-12 lg:pb-5">
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#ea078c] justify-center lg:justify-start"><span className="h-2 w-2 rounded-full bg-[#ea078c]" /> Anniversary challenge</div>
            <h1 className="display-font text-[clamp(1.75rem,5vh,3.25rem)] font-black uppercase leading-[.88] tracking-[-.02em] text-center lg:text-left">Pick your <span className="text-[#ea078c]">reward.</span></h1>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-[#ffffff] px-3 py-2 shadow-[3px_3px_0_#e0d9dd] mx-auto lg:mx-0">
            <Progress count={shots.length} />
            {best > 0 ? <div className="border-l border-[#e0d9dd] pl-4"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#dfdfdf]">Best so far</div><div className="display-font text-2xl font-black text-[#685bc7]">{best}%</div></div> : null}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <GameCourt hoopRewards={hoopRewards} onShot={onShot} shots={shots} />
        </div>
        <div className="mt-3 flex shrink-0 items-center justify-between gap-3 text-xs text-[#dfdfdf]">
          <span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#685bc7] text-white"><Target size={13} /></span> Rewards shuffle after every shot. Same hoop never keeps the same value.</span>
          <span className="hidden font-bold uppercase tracking-[.12em] sm:block">{MAX_SHOTS - shots.length} {MAX_SHOTS - shots.length === 1 ? 'chance' : 'chances'} left</span>
        </div>
      </div>
    </main>
  );
}

function Confetti() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">{Array.from({ length: 15 }).map((_, index) => <span className="confetti-piece absolute h-3 w-2" key={index} style={{ background: ['#ea078c', '#685bc7', '#9f005f', '#ffffff'][index % 4], left: `${(index * 37) % 100}%`, top: `${8 + ((index * 23) % 28)}%`, transform: `rotate(${index * 27}deg)`, animationDelay: `${index * 30}ms` }} />)}</div>;
}

const claimCache = new Map<string, Promise<string | null>>();

function claimCampaignRound(entry: Entry, shots: ShotResult[], best: number, timestamp: string): Promise<string | null> {
  const key = `${entry.email}|${timestamp}`;
  const cached = claimCache.get(key);
  if (cached) return cached;
  const request = completeCampaign({
    name: entry.name,
    email: entry.email,
    phone: entry.phone,
    shots: [shots[0] ?? null, shots[1] ?? null, shots[2] ?? null],
    best,
    timestamp,
  })
    .then((result) => result.couponCode)
    .catch((error: unknown) => {
      claimCache.delete(key);
      throw error;
    });
  claimCache.set(key, request);
  return request;
}

function ClaimingScreen({
  entry,
  shots,
  best,
  timestamp,
  onSuccess,
}: {
  entry: Entry;
  shots: ShotResult[];
  best: number;
  timestamp: string;
  onSuccess: (couponCode: string | null) => void;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function submit() {
    setErrorMessage(null);
    claimCampaignRound(entry, shots, best, timestamp)
      .then(onSuccess)
      .catch((error: unknown) => setErrorMessage(claimErrorMessage(error)));
  }

  useEffect(() => {
    let cancelled = false;
    claimCampaignRound(entry, shots, best, timestamp)
      .then((code) => {
        if (!cancelled) onSuccess(code);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(claimErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [best, entry, onSuccess, shots, timestamp]);

  return (
    <main className="relative grid min-h-[var(--app-height,100svh)] place-items-center overflow-hidden bg-[#1f1f1f] px-5 text-[#fbfbfb]">
      <div className="animate-enter-up w-full max-w-md rounded-[28px] border-2 border-[#ffffff] bg-[#550333] p-8 text-center shadow-[8px_9px_0_#ffffff]">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#685bc7] px-3 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-white">
          <Trophy size={14} /> Claiming reward
        </div>
        {errorMessage ? (
          <>
            <h1 className="display-font text-4xl font-black uppercase leading-none">Hold up</h1>
            <p className="mt-4 text-sm leading-6 text-[#f5c4e0]" data-testid="status-claim-error">{errorMessage}</p>
            <button
              className="mt-7 inline-flex items-center gap-2 rounded-[3px] bg-[#ea078c] px-5 py-3.5 text-sm font-semibold uppercase text-white transition-colors hover:bg-[#550333]"
              data-testid="button-retry-claim"
              onClick={submit}
              type="button"
            >
              <RotateCcw size={16} /> Retry
            </button>
          </>
        ) : (
          <>
            <h1 className="display-font text-4xl font-black uppercase leading-none">Almost there</h1>
            <p className="mt-4 text-sm leading-6 text-[#f5c4e0]" data-testid="status-claiming">
              {best > 0 ? 'Generating your anniversary coupon…' : 'Saving your round…'}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function ResultScreen({ entry, shots, best, couponCode, onRestart }: { entry: Entry; shots: ShotResult[]; best: number; couponCode: string | null; onRestart: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyCoupon() {
    if (!couponCode) return;
    try {
      await navigator.clipboard.writeText(couponCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="relative min-h-[var(--app-height,100svh)] overflow-x-clip bg-[#1f1f1f] text-[#fbfbfb]">
      <Confetti />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-8 sm:py-5 lg:px-12">
        <BrandMark />
        <button
          className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-[#dfdfdf] transition-colors hover:text-[#ea078c] sm:gap-2 sm:text-xs sm:tracking-[.12em]"
          data-testid="button-new-player"
          onClick={onRestart}
          type="button"
        >
          <RotateCcw size={15} /> New player
        </button>
      </header>
      <div className="relative z-10 mx-auto grid min-w-0 max-w-6xl items-center gap-6 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-center sm:gap-10 sm:px-8 sm:pb-12 sm:pt-10 lg:grid-cols-[.95fr_1.05fr] lg:gap-20 lg:pb-24 lg:pt-16 lg:text-left">
        <section className="animate-enter-up min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#685bc7] px-3 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-white sm:mb-6">
            <Trophy size={14} /> Final whistle
          </div>
          <h1 className="result-title display-font text-[32px] font-black uppercase leading-[.95] tracking-[-.04em] sm:text-[clamp(3rem,8vw,6rem)] lg:text-[clamp(4rem,10vw,6rem)] lg:leading-[1]">
            That’s a<br /><span className="text-[#ea078c]">wrap.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#dfdfdf] sm:mt-7 sm:text-lg sm:leading-7 lg:ml-0">
            Nice shooting, <strong className="text-[#ffffff]">{entry.name}</strong>. {couponCode ? 'Your coupon is ready to use at checkout.' : 'Your best landed reward is ready to use.'}
          </p>
          <aside className="entry-terms mx-auto mt-3 max-w-lg rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left sm:mt-6 sm:px-5 sm:py-4 lg:mx-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ea078c] sm:text-[11px]">
              Terms and Conditions
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-4 text-[11px] leading-5 text-[#dfdfdf] sm:text-xs sm:leading-5">
              <li>Game-related offers and promotions cannot be combined with any other ongoing offers, promotions, or discounts.</li>
              <li>However, an additional discount may be applied where specifically stated or permitted by the promotion.</li>
              <li>The company reserves the right to determine the eligibility and applicability of discounts and promotions.</li>
            </ul>
          </aside>
          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:mt-9 lg:justify-start">
            <button className="flex items-center gap-2 rounded-xl bg-[#ea078c] px-5 py-3.5 text-sm font-bold text-[#ffffff] shadow-[0_4px_0_#d1067d] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none" data-testid="button-play-again" onClick={onRestart} type="button">
              <RotateCcw size={16} /> Play again
            </button>
          </div>
        </section>
        <section className="animate-enter-right min-w-0">
          <div className="relative mb-3 mr-2 overflow-hidden rounded-[22px] border-2 border-[#ffffff] bg-[#550333] p-3 shadow-[6px_7px_0_#ffffff] sm:mb-0 sm:mr-0 sm:rounded-[28px] sm:p-7 sm:shadow-[8px_9px_0_#ffffff]">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[23px] border-[#f5c4e0]/20" />
            <div className="relative min-w-0">
              <div className="flex items-center justify-between gap-2 text-[#fce4f2]">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] sm:tracking-[.2em]">Your anniversary score</span>
                <Sparkles className="shrink-0" size={18} />
              </div>
              <div className="mt-4 rounded-2xl bg-[#ffffff] px-3 py-5 text-center sm:mt-5 sm:px-8 sm:py-9">
                <div className="text-[11px] font-bold uppercase tracking-[.2em] text-[#4d4d4d]">Best discount</div>
                <div className="result-best display-font mt-1 text-[56px] font-black leading-[.8] tracking-[-.04em] text-[#ea078c] sm:text-[clamp(5rem,16vw,10rem)]" data-testid="text-best-discount">{best}%</div>
                <div className="mt-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#4d4d4d] sm:text-sm sm:tracking-[.17em]">off your next Quantum pick</div>
                {couponCode ? (
                  <div className="mt-5 rounded-xl border border-[#e0d9dd] bg-[#f7f5f6] px-3 py-3 sm:mt-6 sm:px-4 sm:py-4">
                    <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#636464]">Use at checkout</div>
                    <div className="mt-2 flex min-w-0 items-center justify-center gap-2">
                      <code className="display-font max-w-full break-all text-xl font-black uppercase tracking-[.08em] text-[#292929] sm:text-3xl" data-testid="text-coupon-code">{couponCode}</code>
                      <button aria-label="Copy coupon code" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e0d9dd] text-[#685bc7] hover:bg-[#ffffff]" data-testid="button-copy-coupon" onClick={copyCoupon} type="button">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2">
                {shots.map((shot, index) => (
                  <div className="min-w-0 rounded-xl bg-[#410020]/60 px-1 py-2.5 text-center sm:px-2 sm:py-3" data-testid={`result-shot-${index + 1}`} key={`${shot}-${index}`}>
                    <div className="text-[8px] font-bold uppercase tracking-wider text-[#f5c4e0] sm:text-[9px]">Shot {index + 1}</div>
                    <div className="display-font text-lg font-black text-[#ffffff] sm:text-2xl">{shot === null ? 'Miss' : `${shot}%`}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col items-center gap-1 border-t border-[#f5c4e0]/25 pt-3 text-[9px] font-bold uppercase tracking-[.1em] text-[#f5c4e0] sm:mt-5 sm:flex-row sm:justify-between sm:pt-4 sm:text-[10px] sm:tracking-[.12em]">
                <span>Quantum.lk anniversary</span>
                <span>Keep moving</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Home() {
  const [phase, setPhase] = useState<Session['phase']>('entry');
  const [entry, setEntry] = useState<Entry | null>(null);
  const [shots, setShots] = useState<ShotResult[]>([]);
  const [best, setBest] = useState(0);
  const [hoopRewards, setHoopRewards] = useState<number[]>([]);
  const [timestamp, setTimestamp] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [campaignCompleted, setCampaignCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const showPortraitPrompt = useLandscapePhoneOrTablet();

  useEffect(() => {
    const saved = readSession();
    if (saved?.entry) {
      const completed = Boolean(saved.campaignCompleted);
      const restoredPhase = saved.phase === 'result' && !completed ? 'claiming' : saved.phase;
      setPhase(restoredPhase);
      setEntry(saved.entry);
      setShots(saved.shots ?? []);
      setBest(saved.best ?? 0);
      setHoopRewards(isCurrentRewardSet(saved.hoopRewards) ? saved.hoopRewards : shuffleRewards());
      setTimestamp(saved.timestamp ?? new Date().toISOString());
      setCouponCode(saved.couponCode ?? null);
      setCampaignCompleted(completed);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (entry || phase !== 'entry') {
      const next: Session = {
        phase,
        entry,
        shots,
        best,
        hoopRewards,
        timestamp: timestamp || new Date().toISOString(),
        couponCode,
        campaignCompleted,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [best, campaignCompleted, couponCode, entry, hoopRewards, hydrated, phase, shots, timestamp]);

  function start(entryData: Entry) {
    const time = new Date().toISOString();
    setEntry(entryData);
    setShots([]);
    setBest(0);
    setHoopRewards(shuffleRewards());
    setTimestamp(time);
    setCouponCode(null);
    setCampaignCompleted(false);
    setPhase('game');
  }

  function recordShot(reward: ShotResult) {
    const next = [...shots, reward];
    setShots(next);
    if (reward !== null) setBest(Math.max(best, reward));
    if (next.length === MAX_SHOTS) {
      setPhase('claiming');
      return;
    }
    setHoopRewards((layout) => shuffleRewards(layout));
  }

  const finishClaim = useCallback((code: string | null) => {
    setCouponCode(code);
    setCampaignCompleted(true);
    setPhase('result');
  }, []);

  function restart() {
    window.localStorage.removeItem(STORAGE_KEY);
    setEntry(null);
    setShots([]);
    setBest(0);
    setHoopRewards([]);
    setTimestamp('');
    setCouponCode(null);
    setCampaignCompleted(false);
    setPhase('entry');
  }

  let view: ReactNode;
  if (phase === 'entry' || !entry) view = <EntryScreen onStart={start} />;
  else if (phase === 'claiming' && campaignCompleted) view = <ResultScreen best={best} couponCode={couponCode} entry={entry} onRestart={restart} shots={shots} />;
  else if (phase === 'claiming') view = <ClaimingScreen best={best} entry={entry} onSuccess={finishClaim} shots={shots} timestamp={timestamp} />;
  else if (phase === 'result') view = <ResultScreen best={best} couponCode={couponCode} entry={entry} onRestart={restart} shots={shots} />;
  else view = <GameScreen best={best} entry={entry} hoopRewards={hoopRewards} onRestart={restart} onShot={recordShot} shots={shots} />;

  return (
    <>
      {view}
      {showPortraitPrompt ? <PortraitOverlay /> : null}
    </>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function NotFound() {
  return <main className="grid min-h-[var(--app-height,100svh)] place-items-center bg-[#1f1f1f] text-[#fbfbfb] p-6 text-center"><div><BrandMark /><h1 className="display-font mt-10 text-6xl font-black uppercase">Off court</h1><p className="mt-3 text-[#dfdfdf]">This page does not exist.</p></div></main>;
}

function App() {
  useVisualViewportHeight();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;