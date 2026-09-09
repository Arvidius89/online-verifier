import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@fragment_ui/ui';
import { AppHeader } from '@/components/AppHeader';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { crewMembers, type CrewMember } from '@/data/mockData';
import type { CertificateStatus, ComplianceStatus } from '@/types/compliance';

const certificateStatusLabels: Record<CertificateStatus, string> = {
  valid: 'Valid',
  expiring: 'Expires Soon',
  missing: 'Missing',
  expired: 'Expired',
};

const certificateStatusToCompliance: Record<CertificateStatus, ComplianceStatus> = {
  valid: 'compliant',
  expiring: 'warning',
  missing: 'critical',
  expired: 'critical',
};

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

export function CrewCertificatesPage() {
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(crewMembers[0]?.id ?? '');
  const filteredMembers = useMemo(
    () =>
      crewMembers.filter(({ name, role }) =>
        `${name} ${role}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );
  const selectedMember =
    crewMembers.find(({ id }) => id === selectedMemberId) ?? filteredMembers[0] ?? crewMembers[0];

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-base)]">
      <AppHeader title="Vessel Compliance Manager" user={{ name: 'Master', initials: 'M' }} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.hash = '';
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Dashboard
          </Button>
        </div>
        <PageHeader
          title="Crew Certificates"
          subtitle="Review certification status for every crew member on MV Ocean Pioneer."
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,13fr)]">
          <Card className="w-full shadow-[var(--shadow-sm)]">
            <CardHeader>
              <CardTitle>Crew Members</CardTitle>
              <div className="relative mt-3">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-fg-muted)]"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search crew"
                  aria-label="Search crew members"
                  className="h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border-base)] bg-[color:var(--color-bg-base)] pl-9 pr-3 text-[length:var(--typography-size-sm)] outline-none focus:border-[color:var(--color-brand-primary)]"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2" role="list" aria-label="Crew members">
                {filteredMembers.map((member) => {
                  const status = getMemberStatus(member);
                  const isSelected = member.id === selectedMember?.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      role="listitem"
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-[color:var(--color-brand-primary)] bg-[color:var(--color-bg-subtle)]'
                          : 'border-transparent hover:border-[color:var(--color-border-base)]'
                      }`}
                    >
                      <span>
                        <span className="block text-[length:var(--typography-size-sm)] font-semibold">{member.name}</span>
                        <span className="mt-1 block text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">{member.role}</span>
                      </span>
                      <StatusBadge status={status} label={getMemberStatusLabel(status)} />
                    </button>
                  );
                })}
                {filteredMembers.length === 0 ? (
                  <p className="py-4 text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
                    No crew members found.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {selectedMember ? (
            <section aria-labelledby="selected-crew-heading" className="space-y-4">
              <Card className="w-full shadow-[var(--shadow-sm)]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{selectedMember.name}</CardTitle>
                      <p className="mt-1 text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
                        {selectedMember.role}
                      </p>
                    </div>
                    <StatusBadge
                      status={getMemberStatus(selectedMember)}
                      label={getMemberStatusLabel(getMemberStatus(selectedMember))}
                    />
                  </div>
                </CardHeader>
                <CardContent className="w-full">
                  <h2 id="selected-crew-heading" className="text-[length:var(--typography-size-lg)] font-semibold">
                    Certificate status
                  </h2>
                  <div className="mt-1 flex w-full items-center justify-between gap-4">
                    <p className="text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
                      {selectedMember.certificates.filter(({ status }) => status === 'valid').length} of {selectedMember.certificates.length} certificates valid
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.location.hash = `#/crew/${selectedMember.id}/add-certificate`;
                      }}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Add Certificate
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selectedMember.certificates.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedMember.certificates.map((certificate) => (
                    <Card key={certificate.id} className="w-full shadow-[var(--shadow-sm)]">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle>{certificate.name}</CardTitle>
                          <StatusBadge
                            status={certificateStatusToCompliance[certificate.status]}
                            label={certificateStatusLabels[certificate.status]}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
                          {certificate.expiresAt
                            ? `Expires ${certificate.expiresAt}`
                            : 'Certificate not on file'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="w-full shadow-[var(--shadow-sm)]">
                  <CardContent>
                    <p className="text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
                      No certificates shared yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}