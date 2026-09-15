import type { Metadata } from "next";
import { Envelope, WarningCircle, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { requireUser, getProfile } from "@/lib/auth";
import { getDaySummary } from "@/lib/stats";
import { appUrl, emailConfigured } from "@/lib/email";
import { kcal } from "@/lib/format";
import { Panel, PageTitle, Pill, SectionTitle } from "@/components/ui";
import { MetricCard } from "@/components/metric-card";
import { ProfileForm } from "@/components/profile-form";
import { AppleHealthSetup } from "@/components/apple-health-setup";
import { ActionButton } from "@/components/loggers";

export const metadata: Metadata = { title: "You" };
export const dynamic = "force-dynamic";

export default async function YouPage() {
  const user = await requireUser();
  const [profile, summary] = await Promise.all([getProfile(user.id), getDaySummary(user.id)]);
  const t = summary.targets;
  const ingestUrl = `${appUrl()}/api/health/ingest`;

  return (
    <main className="min-w-0 flex-1 px-5 pb-32 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-2xl">
        <PageTitle title="You" subtitle={user.email} />

        <div className="rise mb-6">
          <p className="hero-num text-[64px] lg:text-[76px]">{t.calories ? kcal(t.calories) : "0"}</p>
          <p className="mt-2.5 text-[14px] font-semibold text-[var(--ink-2)]">kcal daily target</p>
          {t.missing.length > 0 && (
            <div className="mt-3">
              <Pill tone="warning">
                <WarningCircle weight="fill" className="size-3.5" />
                Add {t.missing.join(", ")} below
              </Pill>
            </div>
          )}
        </div>

        <div className="stagger mb-5 grid grid-cols-3 gap-3">
          <MetricCard tint="cal" label="BMR" icon={<CheckCircle weight="fill" />} value={t.bmr ? kcal(t.bmr) : "0"} unit="kcal" sub="at rest" style={{ "--i": 0 } as React.CSSProperties} />
          <MetricCard tint="move" label="Burn" icon={<CheckCircle weight="fill" />} value={t.tdee ? kcal(t.tdee) : "0"} unit="kcal" sub={t.tdeeBasis ?? "estimated"} style={{ "--i": 1 } as React.CSSProperties} />
          <MetricCard tint="body" label="Protein" icon={<CheckCircle weight="fill" />} value={t.proteinG ?? 0} unit="g" sub="daily floor" style={{ "--i": 2 } as React.CSSProperties} />
        </div>

        {t.clamped && (
          <Panel className="mb-5 !bg-[var(--tint-time)]">
            <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">
              Your requested rate would put you below your BMR, so the target was raised to a safe floor.
              Eating under your BMR for long costs muscle, not just fat.
            </p>
          </Panel>
        )}

        <Panel className="mb-4">
          <ProfileForm
            initial={{
              heightCm: profile.heightCm, birthDate: profile.birthDate, sex: profile.sex,
              activityLevel: profile.activityLevel, goal: profile.goal,
              targetWeightKg: profile.targetWeightKg, weeklyRateKg: profile.weeklyRateKg,
              timezone: profile.timezone, waterTargetMl: profile.waterTargetMl,
              stepTarget: profile.stepTarget, fastingTargetHours: profile.fastingTargetHours,
              calorieTargetOverride: profile.calorieTargetOverride,
              proteinTargetG: profile.proteinTargetG, carbTargetG: profile.carbTargetG,
              fatTargetG: profile.fatTargetG, reportEnabled: profile.reportEnabled,
              reportHour: profile.reportHour,
            }}
          />
        </Panel>

        <Panel className="mb-4">
          <AppleHealthSetup endpoint={ingestUrl} token={profile.ingestToken} />
          <div className="mt-4">
            <ActionButton
              endpoint="/api/profile/ingest-token"
              className="btn-ghost"
              successMessage="New token generated. Update your Shortcut."
            >
              Rotate token
            </ActionButton>
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Daily report" hint={`Emailed to ${user.email}`} />
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton endpoint="/api/report/send" className="btn-primary" successMessage="Sent. Check your inbox.">
              <Envelope weight="fill" className="size-[18px]" />
              Send today&apos;s report
            </ActionButton>
            {!emailConfigured() && <Pill tone="warning">RESEND_API_KEY missing</Pill>}
          </div>
        </Panel>

      </div>
    </main>
  );
}
