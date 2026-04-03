export const metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Legal</p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Privacy</h1>
      <p className="mt-4 text-zinc-600">
        This demonstration application is for coursework. Do not enter real personal data. For
        production use, publish a full privacy policy appropriate to your organization.
      </p>
    </div>
  );
}
