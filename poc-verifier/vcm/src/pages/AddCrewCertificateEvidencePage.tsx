import { useState } from 'react';
import { ArrowLeft, Upload, WalletCards } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@fragment_ui/ui';
import { AppHeader } from '@/components/AppHeader';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { crewCertificateTypes, crewMembers, type CrewMember } from '@/data/mockData';
import type { ComplianceStatus } from '@/types/compliance';

interface AddCrewCertificateEvidencePageProps {
  memberId: string;
}

function getMemberStatus(member: CrewMember): ComplianceStatus {
  if (member.certificates.length === 0) {
    return 'critical';
  }
  if (member.certificates.some(({ status }) => status === 'missing' || status === 'expired')) {
    return 'critical';
  }
  if (member.certificates.some(({ status }) => status === 'expiring')) {
    return 'warning';
  }
  return 'compliant';
}

function getMemberStatusLabel(status: ComplianceStatus) {
  return status === 'critical' ? 'Action Required' : status === 'warning' ? 'Warning' : 'Compliant';
}

function MockQrCode() {
  return (
    <div
      aria-label="Mock QR code placeholder"
      className="flex h-40 w-40 items-center justify-center border border-[color:var(--color-border-base)] bg-white text-[length:var(--typography-size-sm)] font-semibold text-[color:var(--color-fg-muted)]"
    >
      QR Code
    </div>
  );
}

export function AddCrewCertificateEvidencePage({ memberId }: AddCrewCertificateEvidencePageProps) {
  const member = crewMembers.find(({ id }) => id === memberId);
  const [selectedWalletCertificate, setSelectedWalletCertificate] = useState<string | null>(null);

  if (!member) {
    return (
      <div className="min-h-screen bg-[color:var(--color-bg-base)]">
        <AppHeader title="Vessel Compliance Manager" user={{ name: 'Master', initials: 'M' }} />
        <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
          <Button variant="ghost" size="sm" onClick={() => { window.location.hash = '#/crew'; }}>
            <ArrowLeft size={16} aria-hidden="true" />
            Crew Certificates
          </Button>
          <PageHeader title="Crew member not found" />
        </main>
      </div>
    );
  }

  const status = getMemberStatus(member);

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-base)]">
      <AppHeader title="Vessel Compliance Manager" user={{ name: 'Master', initials: 'M' }} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <Button variant="ghost" size="sm" onClick={() => { window.location.hash = '#/crew'; }}>
          <ArrowLeft size={16} aria-hidden="true" />
          Crew Certificates
        </Button>
        <PageHeader
          title="Add Certificate Evidence"
          subtitle={`Share certificate evidence for ${member.name}.`}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,13fr)]">
          <Card className="w-full shadow-[var(--shadow-sm)]">
            <CardHeader>
              <CardTitle>{member.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
                {member.role}
              </p>
              <div className="mt-4">
                <StatusBadge status={status} label={getMemberStatusLabel(status)} />
              </div>
            </CardContent>
          </Card>

          <section aria-labelledby="certificate-evidence-heading" className="space-y-4">
            <PageHeader
              title="Certificate Evidence"
              subtitle="Choose how to share each required certificate."
              headingId="certificate-evidence-heading"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {crewCertificateTypes.map((certificateName) => (
                <Card key={certificateName} className="w-full shadow-[var(--shadow-sm)]">
                  <CardHeader>
                    <CardTitle>{certificateName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        <Upload size={16} aria-hidden="true" />
                        Upload File
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedWalletCertificate(certificateName)}
                      >
                        <WalletCards size={16} aria-hidden="true" />
                        Use Wallet
                      </Button>
                    </div>
                    {selectedWalletCertificate === certificateName ? (
                      <div className="mt-4 space-y-4 border-t border-[color:var(--color-border-base)] pt-4">
                        <div className="flex flex-col items-center gap-4 text-center">
                          <MockQrCode />
                          <p className="text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
                            Scan with your wallet
                          </p>
                          <p className="font-semibold text-[length:var(--typography-size-sm)] text-[color:var(--color-status-success-fg)]">
                            &#10003; Shared successfully
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}