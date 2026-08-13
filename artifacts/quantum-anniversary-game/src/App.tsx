import { type CSSProperties, type FormEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Download,
  Mail,
  MoveHorizontal,
  Phone,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();
const STORAGE_KEY = 'quantum-hoops-anniversary-session';
const HOOP_REWARDS = [5, 10, 15, 25] as const;
const HOOP_POSITIONS = [.13, .375, .62, .86] as const;
const MAX_SHOTS = 3;

type Entry = { name: string; email: string; phone: string };
type ShotResult = number | null;
type Session = {
  phase: 'entry' | 'game' | 'result';
  entry: Entry | null;
  shots: ShotResult[];
  best: number;
  timestamp: string;
  hoopRewards: number[];
};

function shuffleRewards() {
  const shuffled = [...HOOP_REWARDS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
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
      <div className="grid h-10 w-10 place-items-center rounded-[11px] bg-[#f65a38] text-[#fff8e9] shadow-[4px_4px_0_#18243b]">
        <span className="display-font text-3xl font-black leading-none">Q</span>
      </div>
      <div className="leading-none">
        <div className="display-font text-[24px] font-black tracking-[.08em] text-[#18243b]">QUANTUM</div>
        <div className="mt-1 text-[9px] font-bold tracking-[.3em] text-[#167f96]">FITNESS GEAR</div>
      </div>
    </div>
  );
}

function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${inverted ? 'text-[#fff8e9]' : 'text-[#18243b]'}`}>
      <div className={`grid h-8 w-8 place-items-center rounded-lg ${inverted ? 'bg-[#f65a38]' : 'bg-[#18243b]'} text-[#fff8e9]`}>
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
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.16em] text-[#536078]">{label}</span>
      <span className={`flex items-center gap-3 rounded-xl border bg-[#fffdf6] px-3.5 transition-colors ${error ? 'border-[#d94135]' : 'border-[#d9d5c7] focus-within:border-[#167f96]'}`}>
        <span className="text-[#167f96]">{icon}</span>
        <input
          aria-invalid={Boolean(error)}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#18243b] outline-none placeholder:text-[#9b9a95]"
          data-testid={testId}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      </span>
      {error ? <span className="mt-1.5 block text-xs font-semibold text-[#d94135]" data-testid={`${testId}-error`}>{error}</span> : null}
    </label>
  );
}

function EntryScreen({ onStart }: { onStart: (entry: Entry) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Tell us your name to join the game.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!/^[+()\d\s-]{7,}$/.test(phone.trim())) next.phone = 'Enter a valid phone number.';
    setErrors(next);
    if (Object.keys(next).length === 0) onStart({ name: name.trim(), email: email.trim(), phone: phone.trim() });
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#f5f1e5] text-[#18243b]">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#f8c842] opacity-80" />
      <div className="absolute bottom-[-170px] left-[-100px] h-96 w-96 rounded-full border-[42px] border-[#167f96]/10" />
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Logo />
        <div className="hidden items-center gap-2 text-right sm:flex">
          <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#536078]">Celebrating</span>
          <span className="display-font text-xl font-black text-[#f65a38]">20 YEARS</span>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-10 pt-8 sm:px-8 lg:grid-cols-[1.12fr_.88fr] lg:gap-20 lg:px-12 lg:pb-24 lg:pt-20">
        <section className="animate-enter-up">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px w-10 bg-[#f65a38]" />
            <span className="text-[11px] font-bold uppercase tracking-[.24em] text-[#f65a38]">Quantum anniversary game</span>
          </div>
          <h1 className="display-font max-w-[700px] text-[clamp(4rem,10vw,8.7rem)] font-black uppercase leading-[.83] tracking-[-.045em]">
            Take your<br /><span className="text-[#f65a38]">best shot.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-[#536078] sm:text-lg">
            Three throws. Four hoops. One reward to take home. Step up and shoot for a Quantum anniversary discount.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-bold uppercase tracking-[.16em] text-[#536078]">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#f65a38]" /> 3 chances</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#f8c842]" /> up to 25% off</span>
          </div>
        </section>

        <section className="animate-enter-right relative mx-auto w-full max-w-[470px]">
          <div className="absolute -right-3 -top-3 z-10 grid h-20 w-20 rotate-6 place-items-center rounded-full bg-[#f8c842] text-center shadow-[4px_5px_0_#18243b]">
            <span className="display-font text-[21px] font-black leading-[.8]">WIN<br />MORE</span>
          </div>
          <div className="rounded-[28px] border border-[#d7d1c0] bg-[#fffdf6] p-6 shadow-[11px_12px_0_#18243b] sm:p-8">
            <div className="mb-7 flex items-start justify-between">
              <div>
                <p className="display-font text-3xl font-black uppercase leading-none">Get on court</p>
                <p className="mt-2 text-sm text-[#536078]">Enter your details to unlock the game.</p>
              </div>
              <div className="rounded-full bg-[#e7f1ee] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#167f96]">Free to play</div>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              <Field error={errors.name} icon={<UserRound size={17} />} label="Your name" onChange={setName} placeholder="e.g. Ayesha Perera" testId="input-player-name" value={name} />
              <Field error={errors.email} icon={<Mail size={17} />} label="Email address" onChange={setEmail} placeholder="you@example.com" testId="input-player-email" type="email" value={email} />
              <Field error={errors.phone} icon={<Phone size={17} />} label="Phone number" onChange={setPhone} placeholder="+94 77 123 4567" testId="input-player-phone" type="tel" value={phone} />
              <button className="group mt-3 flex h-14 w-full items-center justify-between rounded-xl bg-[#f65a38] px-5 text-left text-[#fff8e9] shadow-[0_5px_0_#c43d25] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none" data-testid="button-start-game" type="submit">
                <span>
                  <span className="block display-font text-xl font-black uppercase leading-none">Enter the court</span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-[.15em] text-[#ffd9cc]">Your details stay on this device</span>
                </span>
                <ArrowRight className="transition-transform group-hover:translate-x-1" size={23} />
              </button>
            </form>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-center text-[10px] font-bold uppercase tracking-[.14em] text-[#7c7a72]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#167f96]" /> Quantum.lk anniversary celebration
          </div>
        </section>
      </div>
    </main>
  );
}

function Hoop({ index, active }: { index: number; active: boolean }) {
  const left = `${HOOP_POSITIONS[index] * 100}%`;
  const colors = ['#e8a333', '#f65a38', '#167f96', '#f8c842'];
  const color = colors[index];
  return (
    <div className={`absolute top-[23%] -translate-x-1/2 transition-transform duration-300 ${active ? 'scale-110' : ''}`} style={{ left }} data-testid={`hoop-${index + 1}`}>
      <div className="relative h-[115px] w-[112px] sm:h-[144px] sm:w-[138px]">
        <div className="absolute left-1/2 top-0 h-[53px] w-[72px] -translate-x-1/2 rounded border-[3px] border-[#f6f3e7]/80 bg-[#d9e2df]/20 shadow-[2px_2px_0_#18243b]/30 sm:h-[67px] sm:w-[91px]" />
        <div className="absolute left-1/2 top-[17px] h-[56px] w-[3px] -translate-x-1/2 bg-[#f6f3e7]/70 sm:h-[73px]" />
        <div className="absolute left-1/2 top-[47px] h-3 w-[61px] -translate-x-1/2 rounded-[50%] border-[4px] border-[#f65a38] bg-transparent sm:top-[61px] sm:w-[78px] sm:border-[5px]" style={{ borderColor: color }} />
        <div className={`hoop-net absolute left-1/2 top-[52px] h-[38px] w-[47px] -translate-x-1/2 border-x-[2px] border-b-[2px] border-dashed border-[#f6f3e7]/70 sm:top-[66px] sm:h-[49px] sm:w-[61px]`} />
        <div className="absolute left-1/2 top-[90px] h-5 w-[2px] -translate-x-1/2 bg-[#f6f3e7]/45 sm:top-[113px]" />
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
        <div className="relative h-full w-full rounded-full border-[3px] border-[#9d3a25] bg-[#f65a38] shadow-[4px_6px_0_rgba(24,36,59,.35)]">
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
      <div className="absolute bottom-0 left-1/2 h-[75px] w-[106px] -translate-x-1/2 rounded-[52%_48%_22%_24%] border-[3px] border-[#b94731] bg-[#f07a5a] shadow-[5px_5px_0_rgba(24,36,59,.24)] sm:h-[92px] sm:w-[128px]" />
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
      className="court-grain relative h-[min(70vh,640px)] min-h-[520px] w-full touch-none overflow-hidden rounded-[24px] border-[3px] border-[#18243b] bg-[#167f96] shadow-[7px_8px_0_#18243b] sm:min-h-[600px] sm:rounded-[32px]"
      data-testid="game-court"
      onPointerDown={startAim}
      onPointerMove={moveAim}
      onPointerUp={endAim}
      ref={courtRef}
      role="application"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,111,132,.95),rgba(15,126,148,.94))]" />
      <div className="absolute inset-x-0 top-[14%] h-px bg-[#bce4e1]/30" />
      <div className="absolute left-1/2 top-[9%] h-[43%] w-[55%] -translate-x-1/2 rounded-[50%] border border-[#bce4e1]/35" />
      <div className="absolute left-1/2 top-[20%] h-[21%] w-[25%] -translate-x-1/2 border border-[#bce4e1]/25" />
      <div className="absolute bottom-0 left-1/2 h-[18%] w-[68%] -translate-x-1/2 rounded-t-[50%] border-t-2 border-[#bce4e1]/35" />
      <div className="absolute bottom-0 left-1/2 h-[7px] w-full -translate-x-1/2 bg-[#f8c842]" />
      <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-[#0d5366]/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#d8f0eb] sm:left-7 sm:top-7">
        <Target size={14} /> Aim and release
      </div>
      {HOOP_POSITIONS.map((_position, index) => <Hoop active={activeHoop === index} index={index} key={index} />)}
      <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[5] h-full w-full transition-opacity duration-200 ${isAiming ? 'opacity-100' : 'opacity-35'}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d={`M 50 82 Q 50 56 ${pathEndX} ${pathEndY}`} fill="none" pathLength="1" stroke="#f8c842" strokeDasharray="0.025 0.02" strokeLinecap="round" strokeWidth="0.7" />
        <circle cx={pathEndX} cy={pathEndY} fill="#f8c842" r={isAiming ? "1.6" : "1.15"} />
        <circle cx={pathEndX} cy={pathEndY} fill="none" opacity={isAiming ? ".75" : ".35"} r={isAiming ? "3.5" : "2.5"} stroke="#f8c842" strokeWidth=".45" />
      </svg>
      <div className={`absolute bottom-[18%] left-1/2 z-10 -translate-x-1/2 transition-opacity ${isAiming ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[#18243b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#fff8e9]">
          <MoveHorizontal size={13} /> Hold · drag · release
        </div>
      </div>
      <Hand aiming={isAiming} />
      <Basketball aim={aim} aiming={isAiming} shotStyle={shotStyle} shooting={isShooting} />
      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[.15em] text-[#c8e8e4]/80 sm:bottom-4">
        {isShooting ? 'On its way...' : isAiming ? 'Guide the path to a hoop' : 'Hold the ball and drag'}
      </div>
      {landed !== null ? (
        <div className="animate-enter-up absolute left-1/2 top-[49%] z-30 -translate-x-1/2 rounded-2xl border-2 border-[#18243b] bg-[#f8c842] px-5 py-3 text-center shadow-[5px_5px_0_#18243b]" data-testid="status-landed">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#536078]">{landed === 'miss' ? 'Just missed' : 'Reward unlocked'}</div>
          <div className="display-font text-4xl font-black leading-none">{landed === 'miss' ? 'No hoop' : `${landed}% OFF`}</div>
        </div>
      ) : null}
    </div>
  );
}

function Progress({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2" data-testid="status-attempts">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-[.15em] text-[#536078]">Shots</span>
      {[0, 1, 2].map((attempt) => (
        <span className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-black ${attempt < count ? 'border-[#f65a38] bg-[#f65a38] text-[#fff8e9]' : 'border-[#c9c5b8] bg-transparent text-[#8b897f]'}`} data-testid={`attempt-${attempt + 1}`} key={attempt}>
          {attempt < count ? <Check size={15} strokeWidth={3} /> : attempt + 1}
        </span>
      ))}
    </div>
  );
}

function GameScreen({ entry, shots, best, hoopRewards, onShot, onRestart }: { entry: Entry; shots: ShotResult[]; best: number; hoopRewards: number[]; onShot: (reward: ShotResult) => void; onRestart: () => void }) {
  return (
    <main className="min-h-[100dvh] bg-[#f5f1e5] text-[#18243b]">
      <header className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        <BrandMark />
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7c7a72]">Player</div><div className="text-sm font-bold">{entry.name}</div></div>
          <button aria-label="Start over with a new player" className="grid h-10 w-10 place-items-center rounded-full border border-[#d4cfc1] text-[#536078] transition-colors hover:bg-[#fffdf6] hover:text-[#f65a38]" data-testid="button-restart-top" onClick={onRestart} type="button"><RotateCcw size={16} /></button>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8 lg:px-12 lg:pb-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-5 sm:mb-7">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#f65a38]"><span className="h-2 w-2 rounded-full bg-[#f65a38]" /> Anniversary challenge</div>
            <h1 className="display-font text-5xl font-black uppercase leading-[.88] tracking-[-.02em] sm:text-6xl">Pick your <span className="text-[#f65a38]">reward.</span></h1>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-[#fffdf6] px-3 py-2.5 shadow-[3px_3px_0_#d6d0c2]">
            <Progress count={shots.length} />
            {best > 0 ? <div className="border-l border-[#ddd8ca] pl-4"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#536078]">Best so far</div><div className="display-font text-2xl font-black text-[#167f96]">{best}%</div></div> : null}
          </div>
        </div>
        <GameCourt hoopRewards={hoopRewards} onShot={onShot} shots={shots} />
        <div className="mt-5 flex items-center justify-between gap-3 text-xs text-[#536078]">
          <span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#f8c842] text-[#18243b]"><Target size={13} /></span> Hit a hoop to reveal its hidden reward.</span>
          <span className="hidden font-bold uppercase tracking-[.12em] sm:block">{MAX_SHOTS - shots.length} {MAX_SHOTS - shots.length === 1 ? 'chance' : 'chances'} left</span>
        </div>
      </div>
    </main>
  );
}

function Confetti() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">{Array.from({ length: 15 }).map((_, index) => <span className="confetti-piece absolute h-3 w-2" key={index} style={{ background: ['#f65a38', '#f8c842', '#167f96', '#18243b'][index % 4], left: `${(index * 37) % 100}%`, top: `${8 + ((index * 23) % 28)}%`, transform: `rotate(${index * 27}deg)`, animationDelay: `${index * 30}ms` }} />)}</div>;
}

function ExportPanel({ entry, shots, best, timestamp, onClose }: { entry: Entry; shots: ShotResult[]; best: number; timestamp: string; onClose: () => void }) {
  function download() {
    const cells = [entry.name, entry.email, entry.phone, shots[0] ?? '', shots[1] ?? '', shots[2] ?? '', best, timestamp];
    const csv = ['player_name,email,phone,shot_1_discount,shot_2_discount,shot_3_discount,best_discount,timestamp', cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quantum-hoops-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'player'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="animate-enter-up fixed inset-0 z-50 flex items-end justify-center bg-[#18243b]/45 p-3 sm:items-center sm:p-6" role="dialog">
      <div className="relative w-full max-w-[510px] rounded-[24px] border-2 border-[#18243b] bg-[#fffdf6] p-6 shadow-[7px_8px_0_#18243b] sm:p-8">
        <button aria-label="Close export panel" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#536078] hover:bg-[#f0ece0]" data-testid="button-close-export" onClick={onClose} type="button"><X size={17} /></button>
        <div className="mb-6 flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e7f1ee] text-[#167f96]"><Download size={20} /></div><div><h2 className="display-font text-3xl font-black uppercase leading-none">Campaign export</h2><p className="mt-2 max-w-sm text-sm leading-5 text-[#536078]">Google Sheets is not connected yet. Download this round as a CSV for campaign records.</p></div></div>
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-[#f5f1e5] p-3 text-sm"><div><span className="block text-[10px] font-bold uppercase tracking-wider text-[#7c7a72]">Player</span><span className="font-bold">{entry.name}</span></div><div><span className="block text-[10px] font-bold uppercase tracking-wider text-[#7c7a72]">Best reward</span><span className="font-bold text-[#f65a38]">{best}% off</span></div></div>
        <button className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#18243b] px-5 py-3.5 text-sm font-bold text-[#fff8e9] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-download-results" onClick={download} type="button"><Download size={17} /> Download results CSV</button>
      </div>
    </div>
  );
}

function ResultScreen({ entry, shots, best, timestamp, onRestart }: { entry: Entry; shots: ShotResult[]; best: number; timestamp: string; onRestart: () => void }) {
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#f5f1e5] text-[#18243b]">
      <Confetti />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12"><BrandMark /><button className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#536078] transition-colors hover:text-[#f65a38]" data-testid="button-new-player" onClick={onRestart} type="button"><RotateCcw size={15} /> New player</button></header>
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-12 pt-10 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:gap-20 lg:pb-24 lg:pt-16">
        <section className="animate-enter-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#f8c842] px-3 py-2 text-[10px] font-bold uppercase tracking-[.16em]"><Trophy size={14} /> Final whistle</div>
          <h1 className="display-font text-[clamp(4.4rem,10vw,8rem)] font-black uppercase leading-[.8] tracking-[-.04em]">That’s a<br /><span className="text-[#f65a38]">wrap.</span></h1>
          <p className="mt-7 max-w-md text-lg leading-7 text-[#536078]">Nice shooting, <strong className="text-[#18243b]">{entry.name}</strong>. Your best landed reward is ready to use.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button className="flex items-center gap-2 rounded-xl bg-[#f65a38] px-5 py-3.5 text-sm font-bold text-[#fff8e9] shadow-[0_4px_0_#c43d25] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none" data-testid="button-play-again" onClick={onRestart} type="button"><RotateCcw size={16} /> Play again</button>
            <button className="flex items-center gap-2 rounded-xl border-2 border-[#18243b] bg-transparent px-5 py-3 text-sm font-bold text-[#18243b] transition-colors hover:bg-[#fffdf6]" data-testid="button-open-export" onClick={() => setExportOpen(true)} type="button"><Download size={16} /> Campaign export</button>
          </div>
        </section>
        <section className="animate-enter-right">
          <div className="relative overflow-hidden rounded-[28px] border-2 border-[#18243b] bg-[#167f96] p-5 shadow-[8px_9px_0_#18243b] sm:p-7">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[23px] border-[#bce4e1]/20" />
            <div className="relative">
              <div className="flex items-center justify-between text-[#d8f0eb]"><span className="text-[10px] font-bold uppercase tracking-[.2em]">Your anniversary score</span><Sparkles size={18} /></div>
              <div className="mt-5 rounded-2xl bg-[#fff8e9] px-5 py-6 text-center sm:px-8 sm:py-9">
                <div className="text-[11px] font-bold uppercase tracking-[.2em] text-[#536078]">Best discount</div>
                <div className="display-font mt-1 text-[clamp(6rem,16vw,10rem)] font-black leading-[.8] tracking-[-.04em] text-[#f65a38]" data-testid="text-best-discount">{best}%</div>
                <div className="mt-3 text-sm font-bold uppercase tracking-[.17em] text-[#18243b]">off your next Quantum pick</div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">{shots.map((shot, index) => <div className="rounded-xl bg-[#0d5366]/60 px-2 py-3 text-center" data-testid={`result-shot-${index + 1}`} key={`${shot}-${index}`}><div className="text-[9px] font-bold uppercase tracking-wider text-[#bce4e1]">Shot {index + 1}</div><div className="display-font text-2xl font-black text-[#fff8e9]">{shot === null ? 'Miss' : `${shot}%`}</div></div>)}</div>
              <div className="mt-5 flex items-center justify-between border-t border-[#bce4e1]/25 pt-4 text-[10px] font-bold uppercase tracking-[.12em] text-[#bce4e1]"><span>Quantum.lk anniversary</span><span>Keep moving</span></div>
            </div>
          </div>
        </section>
      </div>
      {exportOpen ? <ExportPanel best={best} entry={entry} onClose={() => setExportOpen(false)} shots={shots} timestamp={timestamp} /> : null}
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readSession();
    if (saved?.entry) {
      setPhase(saved.phase);
      setEntry(saved.entry);
      setShots(saved.shots ?? []);
      setBest(saved.best ?? 0);
      setHoopRewards(saved.hoopRewards?.length === HOOP_REWARDS.length ? saved.hoopRewards : shuffleRewards());
      setTimestamp(saved.timestamp ?? new Date().toISOString());
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (entry || phase !== 'entry') {
      const next: Session = { phase, entry, shots, best, hoopRewards, timestamp: timestamp || new Date().toISOString() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [best, entry, hoopRewards, hydrated, phase, shots, timestamp]);

  function start(entryData: Entry) {
    const time = new Date().toISOString();
    setEntry(entryData);
    setShots([]);
    setBest(0);
    setHoopRewards(shuffleRewards());
    setTimestamp(time);
    setPhase('game');
  }

  function recordShot(reward: ShotResult) {
    const next = [...shots, reward];
    setShots(next);
    if (reward !== null) setBest(Math.max(best, reward));
    if (next.length === MAX_SHOTS) setPhase('result');
  }

  function restart() {
    window.localStorage.removeItem(STORAGE_KEY);
    setEntry(null);
    setShots([]);
    setBest(0);
    setHoopRewards([]);
    setTimestamp('');
    setPhase('entry');
  }

  if (phase === 'entry' || !entry) return <EntryScreen onStart={start} />;
  if (phase === 'result') return <ResultScreen best={best} entry={entry} onRestart={restart} shots={shots} timestamp={timestamp} />;
  return <GameScreen best={best} entry={entry} hoopRewards={hoopRewards} onRestart={restart} onShot={recordShot} shots={shots} />;
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
  return <main className="grid min-h-[100dvh] place-items-center bg-[#f5f1e5] p-6 text-center"><div><BrandMark /><h1 className="display-font mt-10 text-6xl font-black uppercase">Off court</h1><p className="mt-3 text-[#536078]">This page does not exist.</p></div></main>;
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