import { LeadDetail } from '@/components/leads/lead-detail';

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  return <LeadDetail leadId={params.id} />;
}
