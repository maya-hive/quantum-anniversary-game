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
const HOOP_REWARDS = [5, 10, 15, 25] as const;
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

function shuffleRewards() {
  const shuffled = [...HOOP_REWARDS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function usePortraitPhoneOrTablet() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const landscape = window.matchMedia('(orientation: landscape)');
    const coarse = window.matchMedia('(pointer: coarse)');
    const compact = window.matchMedia('(max-width: 1024px)');

    function update() {
      setShow(!landscape.matches && (coarse.matches || compact.matches));
    }

    update();
    landscape.addEventListener('change', update);
    coarse.addEventListener('change', update);
    compact.addEventListener('change', update);
    return () => {
      landscape.removeEventListener('change', update);
      coarse.removeEventListener('change', update);
      compact.removeEventListener('change', update);
    };
  }, []);

  return show;
}

function LandscapeOverlay() {
  return (
    <div
      aria-live="polite"
      className="pointer-events-auto fixed inset-0 z-[80] grid place-items-center bg-[#1f1f1f] px-6 text-center text-[#fbfbfb]"
      data-testid="overlay-landscape"
      role="dialog"
      aria-labelledby="landscape-heading"
      aria-modal="true"
    >
      <div className="flex max-w-sm flex-col items-center">
        <svg aria-hidden="true" className="device-to-landscape h-28 w-28" fill="none" viewBox="0 0 80 120">
          <rect height="112" rx="14" stroke="#ea078c" strokeWidth="4" width="64" x="8" y="4" />
          <rect fill="#685bc7" height="6" rx="3" width="22" x="29" y="12" />
          <circle cx="40" cy="104" fill="#685bc7" r="5" />
        </svg>
        <h2 className="display-font mt-8 text-4xl font-black uppercase leading-none" id="landscape-heading">Turn your device</h2>
        <p className="mt-4 text-sm font-medium leading-6 text-[#dfdfdf]">This game is best played in landscape. Rotate your phone or tablet to continue.</p>
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
    <div className="flex items-center gap-2.5" data-testid="brand-quantum">
      <div className="grid h-10 w-10 place-items-center rounded-[11px] bg-[#ea078c] text-[#ffffff] shadow-[4px_4px_0_#ffffff]">
        <span className="display-font text-3xl font-black leading-none">Q</span>
      </div>
      <div className="leading-none">
        <div className="display-font text-[24px] font-black tracking-[.08em] text-[#ffffff]">QUANTUM</div>
        <div className="mt-1 text-[9px] font-bold tracking-[.3em] text-[#685bc7]">FITNESS GEAR</div>
      </div>
    </div>
  );
}

function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${inverted ? 'text-[#ffffff]' : 'text-[#ffffff]'}`}>
      <div className={`grid h-8 w-8 place-items-center rounded-lg ${inverted ? 'bg-[#ea078c]' : 'bg-[#ffffff]'} text-[#ffffff]`}>
        <span className="display-font text-2xl font-black leading-none">Q</span>
      </div>
      <span className="display-font text-lg font-black tracking-[.09em]">QUANTUM.LK</span>
    </div>
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
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.16em] text-[#3f3f3f]">{label}</span>
      <span className={`flex items-center gap-3 rounded-xl border bg-[#ffffff] px-3.5 transition-colors ${error ? 'border-[#e9002b]' : 'border-[#e0d9dd] focus-within:border-[#685bc7]'}`}>
        <span className="text-[#685bc7]">{icon}</span>
        <input
          aria-invalid={Boolean(error)}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#191919] outline-none placeholder:text-[#9a9398]"
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
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#1f1f1f] text-[#fbfbfb]">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#685bc7] opacity-80" />
      <div className="absolute bottom-[-170px] left-[-100px] h-96 w-96 rounded-full border-[42px] border-[#685bc7]/10" />
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Logo />
        <div className="hidden items-center gap-2 text-right sm:flex">
          <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#dfdfdf]">Celebrating</span>
          <span className="display-font text-xl font-black text-[#ea078c]">28 YEARS</span>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-10 pt-8 sm:px-8 lg:grid-cols-[1.12fr_.88fr] lg:gap-20 lg:px-12 lg:pb-24 lg:pt-20">
        <section className="animate-enter-up">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px w-10 bg-[#ea078c]" />
            <span className="text-[11px] font-bold uppercase tracking-[.24em] text-[#ea078c]">Quantum anniversary game</span>
          </div>
          <h1 className="display-font max-w-[700px] text-[clamp(4rem,10vw,6rem)] font-black uppercase leading-[1] tracking-[-.045em]">
            Take your<br /><span className="text-[#ea078c]">best shot.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-[#dfdfdf] sm:text-lg">
            Three throws. Four hoops. One reward to take home. Step up and shoot for a Quantum anniversary discount.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-bold uppercase tracking-[.16em] text-[#dfdfdf]">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ea078c]" /> 3 chances</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#685bc7]" /> up to 25% off</span>
          </div>
        </section>

        <section className="animate-enter-right relative mx-auto w-full max-w-[470px]">
          <div className="absolute -right-3 -top-14 z-10 grid h-20 w-20 rotate-6 place-items-center rounded-full bg-[#685bc7] text-center text-white shadow-[4px_5px_0_#121212]">
            <span className="display-font text-[21px] font-black leading-[.8]">WIN<br />MORE</span>
          </div>
          <div className="rounded-[28px] border border-[#e0d9dd] bg-[#ffffff] p-6 shadow-[11px_12px_0_#121212] sm:p-8">
            <div className="mb-7 flex items-start justify-between">
              <div>
                <p className="display-font text-3xl font-black uppercase leading-none text-[#3f3f3f]">Get on court</p>
                <p className="mt-2 text-sm text-[#3f3f3f]">Enter your details to unlock the game.</p>
              </div>
              <div className="rounded-full bg-[#fce4f2] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#685bc7]">Free to play</div>
            </div>
            <form className="space-y-4" onSubmit={submit}>
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
  const colors = ['#ea078c', '#685bc7', '#9f005f', '#b02ef2'];
  const color = colors[index];
  return (
    <div className={`absolute top-[23%] -translate-x-1/2 transition-transform duration-300 ${active ? 'scale-110' : ''}`} style={{ left }} data-testid={`hoop-${index + 1}`}>
      <div className="relative h-[115px] w-[112px] sm:h-[144px] sm:w-[138px]">
        <div className="absolute left-1/2 top-0 h-[53px] w-[72px] -translate-x-1/2 rounded border-[3px] border-[#f7f5f6]/80 bg-[#f5d0e8]/20 shadow-[2px_2px_0_#ffffff]/30 sm:h-[67px] sm:w-[91px]" />
        <div className="absolute left-1/2 top-[17px] h-[56px] w-[3px] -translate-x-1/2 bg-[#f7f5f6]/70 sm:h-[73px]" />
        <div className="absolute left-1/2 top-[47px] h-3 w-[61px] -translate-x-1/2 rounded-[50%] border-[4px] border-[#ea078c] bg-transparent sm:top-[61px] sm:w-[78px] sm:border-[5px]" style={{ borderColor: color }} />
        <div className={`hoop-net absolute left-1/2 top-[52px] h-[38px] w-[47px] -translate-x-1/2 border-x-[2px] border-b-[2px] border-dashed border-[#f7f5f6]/70 sm:top-[66px] sm:h-[49px] sm:w-[61px]`} />
        <div className="absolute left-1/2 top-[90px] h-5 w-[2px] -translate-x-1/2 bg-[#f7f5f6]/45 sm:top-[113px]" />
      </div>
    </div>
  );
}

function Basketball({ aiming, aim, shooting, shotStyle }: { aiming: boolean; aim: { x: number; y: number }; shooting: boolean; shotStyle?: CSSProperties }) {
  const pullX = aiming && !shooting ? (aim.x - .5) * 18 : 0;
  const pullY = aiming && !shooting ? (aim.y - .72) * 18 : 0;
  return (
    <div className="absolute bottom-[8%] left-1/2 z-20 h-14 w-14 -ml-7 transition-transform duration-150 sm:h-[70px] sm:w-[70px] sm:-ml-[35px]" style={{ transform: `translate3d(${pullX}px, ${pullY}px, 0)` }}>
      <div className={`relative h-full w-full ${shooting ? 'shot-animation' : 'animate-float-ball'}`} style={shotStyle}>
        <div className="relative h-full w-full rounded-full border-[3px] border-[#9d3a25] bg-[#f65a38] shadow-[4px_6px_0_rgba(27,27,27,.35)]">
          <span className="absolute left-1/2 top-[-4px] h-[calc(100%+8px)] w-[3px] -translate-x-1/2 rotate-[33deg] rounded-full bg-[#9d3a25]" />
          <span className="absolute left-[-4px] top-[40%] h-[3px] w-[calc(100%+8px)] rotate-[-34deg] rounded-full bg-[#9d3a25]" />
          <span className="absolute left-[9%] top-[24%] h-[3px] w-[83%] rotate-[62deg] rounded-full bg-[#9d3a25]" />
        </div>
      </div>
    </div>
  );
}

function Hand({ aiming }: { aiming: boolean }) {
  return (
    <div className={`absolute bottom-[-13px] left-1/2 z-10 h-[110px] w-[142px] -translate-x-1/2 transition-transform sm:h-[135px] sm:w-[174px] ${aiming ? 'scale-105' : ''}`}>
      <div className="absolute bottom-0 left-1/2 h-[75px] w-[106px] -translate-x-1/2 rounded-[52%_48%_22%_24%] border-[3px] border-[#b94731] bg-[#f07a5a] shadow-[5px_5px_0_rgba(27,27,27,.24)] sm:h-[92px] sm:w-[128px]" />
      <div className="absolute bottom-[43px] left-[18px] h-[63px] w-[33px] -rotate-[41deg] rounded-full border-[3px] border-[#b94731] bg-[#f58d6d] sm:bottom-[53px] sm:left-[21px] sm:h-[75px] sm:w-[42px]" />
      <div className="absolute bottom-[47px] right-[8px] h-[59px] w-[29px] rotate-[28deg] rounded-full border-[3px] border-[#b94731] bg-[#f58d6d] sm:bottom-[58px] sm:right-[10px] sm:h-[74px] sm:w-[36px]" />
      <div className="absolute bottom-[64px] left-[48px] h-[34px] w-[26px] -rotate-[15deg] rounded-full border-[3px] border-[#b94731] bg-[#f58d6d] sm:bottom-[77px] sm:left-[60px] sm:h-[42px] sm:w-[32px]" />
      <div className="absolute bottom-[60px] left-[73px] h-[39px] w-[27px] rotate-[10deg] rounded-full border-[3px] border-[#b94731] bg-[#f58d6d] sm:bottom-[73px] sm:left-[89px] sm:h-[48px] sm:w-[33px]" />
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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(85,3,51,.96),rgba(159,0,95,.94))]" />
      <div className="absolute inset-x-0 top-[14%] h-px bg-[#f5c4e0]/30" />
      <div className="absolute left-1/2 top-[9%] h-[43%] w-[55%] -translate-x-1/2 rounded-[50%] border border-[#f5c4e0]/35" />
      <div className="absolute left-1/2 top-[20%] h-[21%] w-[25%] -translate-x-1/2 border border-[#f5c4e0]/25" />
      <div className="absolute bottom-0 left-1/2 h-[18%] w-[68%] -translate-x-1/2 rounded-t-[50%] border-t-2 border-[#f5c4e0]/35" />
      <div className="absolute bottom-0 left-1/2 h-[7px] w-full -translate-x-1/2 bg-[#ea078c]" />
      <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-[#410020]/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#fce4f2] sm:left-7 sm:top-7">
        <Target size={14} /> Aim and release
      </div>
      {HOOP_POSITIONS.map((_position, index) => <Hoop active={activeHoop === index} index={index} key={index} />)}
      <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[5] h-full w-full transition-opacity duration-200 ${isAiming ? 'opacity-100' : 'opacity-35'}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d={`M 50 82 Q 50 56 ${pathEndX} ${pathEndY}`} fill="none" pathLength="1" stroke="#ea078c" strokeDasharray="0.025 0.02" strokeLinecap="round" strokeWidth="0.7" />
        <circle cx={pathEndX} cy={pathEndY} fill="#ea078c" r={isAiming ? "1.6" : "1.15"} />
        <circle cx={pathEndX} cy={pathEndY} fill="none" opacity={isAiming ? ".75" : ".35"} r={isAiming ? "3.5" : "2.5"} stroke="#ea078c" strokeWidth=".45" />
      </svg>
      <div className={`absolute bottom-[18%] left-1/2 z-10 -translate-x-1/2 transition-opacity ${isAiming ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[#ffffff] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#ffffff]">
          <MoveHorizontal size={13} /> Hold · drag · release
        </div>
      </div>
      <Hand aiming={isAiming} />
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
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#1f1f1f] text-[#fbfbfb]">
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
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#ea078c]"><span className="h-2 w-2 rounded-full bg-[#ea078c]" /> Anniversary challenge</div>
            <h1 className="display-font text-[clamp(1.75rem,5vh,3.25rem)] font-black uppercase leading-[.88] tracking-[-.02em]">Pick your <span className="text-[#ea078c]">reward.</span></h1>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-[#ffffff] px-3 py-2 shadow-[3px_3px_0_#e0d9dd]">
            <Progress count={shots.length} />
            {best > 0 ? <div className="border-l border-[#e0d9dd] pl-4"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#dfdfdf]">Best so far</div><div className="display-font text-2xl font-black text-[#685bc7]">{best}%</div></div> : null}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <GameCourt hoopRewards={hoopRewards} onShot={onShot} shots={shots} />
        </div>
        <div className="mt-3 flex shrink-0 items-center justify-between gap-3 text-xs text-[#dfdfdf]">
          <span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#685bc7] text-white"><Target size={13} /></span> Hit a hoop to reveal its hidden reward.</span>
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
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#1f1f1f] px-5 text-[#fbfbfb]">
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
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#1f1f1f] text-[#fbfbfb]">
      <Confetti />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12"><BrandMark /><button className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#dfdfdf] transition-colors hover:text-[#ea078c]" data-testid="button-new-player" onClick={onRestart} type="button"><RotateCcw size={15} /> New player</button></header>
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-12 pt-10 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:gap-20 lg:pb-24 lg:pt-16">
        <section className="animate-enter-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#685bc7] px-3 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-white"><Trophy size={14} /> Final whistle</div>
          <h1 className="display-font text-[clamp(4rem,10vw,6rem)] font-black uppercase leading-[1] tracking-[-.04em]">That’s a<br /><span className="text-[#ea078c]">wrap.</span></h1>
          <p className="mt-7 max-w-md text-lg leading-7 text-[#dfdfdf]">Nice shooting, <strong className="text-[#ffffff]">{entry.name}</strong>. {couponCode ? 'Your coupon is ready to use at checkout.' : 'Your best landed reward is ready to use.'}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button className="flex items-center gap-2 rounded-xl bg-[#ea078c] px-5 py-3.5 text-sm font-bold text-[#ffffff] shadow-[0_4px_0_#d1067d] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none" data-testid="button-play-again" onClick={onRestart} type="button"><RotateCcw size={16} /> Play again</button>
          </div>
        </section>
        <section className="animate-enter-right">
          <div className="relative overflow-hidden rounded-[28px] border-2 border-[#ffffff] bg-[#550333] p-5 shadow-[8px_9px_0_#ffffff] sm:p-7">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[23px] border-[#f5c4e0]/20" />
            <div className="relative">
              <div className="flex items-center justify-between text-[#fce4f2]"><span className="text-[10px] font-bold uppercase tracking-[.2em]">Your anniversary score</span><Sparkles size={18} /></div>
              <div className="mt-5 rounded-2xl bg-[#ffffff] px-5 py-6 text-center sm:px-8 sm:py-9">
                <div className="text-[11px] font-bold uppercase tracking-[.2em] text-[#4d4d4d]">Best discount</div>
                <div className="display-font mt-1 text-[clamp(6rem,16vw,10rem)] font-black leading-[.8] tracking-[-.04em] text-[#ea078c]" data-testid="text-best-discount">{best}%</div>
                <div className="mt-3 text-sm font-bold uppercase tracking-[.17em] text-[#4d4d4d]">off your next Quantum pick</div>
                {couponCode ? (
                  <div className="mt-6 rounded-xl border border-[#e0d9dd] bg-[#f7f5f6] px-4 py-4">
                    <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#636464]">Use at checkout</div>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <code className="display-font text-3xl font-black tracking-[.08em] text-[#292929] uppercase" data-testid="text-coupon-code">{couponCode}</code>
                      <button aria-label="Copy coupon code" className="grid h-9 w-9 place-items-center rounded-full border border-[#e0d9dd] text-[#685bc7] hover:bg-[#ffffff]" data-testid="button-copy-coupon" onClick={copyCoupon} type="button">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">{shots.map((shot, index) => <div className="rounded-xl bg-[#410020]/60 px-2 py-3 text-center" data-testid={`result-shot-${index + 1}`} key={`${shot}-${index}`}><div className="text-[9px] font-bold uppercase tracking-wider text-[#f5c4e0]">Shot {index + 1}</div><div className="display-font text-2xl font-black text-[#ffffff]">{shot === null ? 'Miss' : `${shot}%`}</div></div>)}</div>
              <div className="mt-5 flex items-center justify-between border-t border-[#f5c4e0]/25 pt-4 text-[10px] font-bold uppercase tracking-[.12em] text-[#f5c4e0]"><span>Quantum.lk anniversary</span><span>Keep moving</span></div>
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
  const showLandscapePrompt = usePortraitPhoneOrTablet();

  useEffect(() => {
    const saved = readSession();
    if (saved?.entry) {
      const completed = Boolean(saved.campaignCompleted);
      const restoredPhase = saved.phase === 'result' && !completed ? 'claiming' : saved.phase;
      setPhase(restoredPhase);
      setEntry(saved.entry);
      setShots(saved.shots ?? []);
      setBest(saved.best ?? 0);
      setHoopRewards(saved.hoopRewards?.length === HOOP_REWARDS.length ? saved.hoopRewards : shuffleRewards());
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
    if (next.length === MAX_SHOTS) setPhase('claiming');
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
      {showLandscapePrompt ? <LandscapeOverlay /> : null}
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
  return <main className="grid min-h-[100dvh] place-items-center bg-[#1f1f1f] text-[#fbfbfb] p-6 text-center"><div><BrandMark /><h1 className="display-font mt-10 text-6xl font-black uppercase">Off court</h1><p className="mt-3 text-[#dfdfdf]">This page does not exist.</p></div></main>;
}

function App() {
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