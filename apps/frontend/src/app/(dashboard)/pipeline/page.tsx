import { PipelineBoard } from '@/components/pipeline/pipeline-board';

export default function PipelinePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Drag leads through stages to track your sales process
        </p>
      </div>
      <PipelineBoard />
    </div>
  );
}
