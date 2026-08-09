import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-[#e6e4e2] p-6">
      <div className="w-full max-w-[520px] border-2 border-[#201e1d] bg-white p-10 shadow-[0_24px_60px_rgba(0,0,0,.18)]">
        <p className="text-[10px] font-extrabold uppercase tracking-[.28em] text-[#8a8378]">Ribbet</p>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-[38px] leading-tight text-[#201e1d]">
          Your wedding, in your own Google account.
        </h1>
        <p className="mt-4 text-[14px] leading-[1.6] text-[#5f6368]">
          The marketing page is deliberately not designed yet. Start the couple intake instead.
        </p>
        <Link
          href="/setup"
          className="mt-8 inline-block border-2 border-[#201e1d] bg-[#201e1d] px-6 py-3 text-[15px] font-extrabold text-white"
        >
          Set up a wedding
        </Link>
      </div>
    </main>
  );
}
