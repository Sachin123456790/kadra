import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import {
  listAdminJobs,
  triggerJob,
  type AdminJobDefinition,
} from "@/services/notices.service";
import { toFriendlyMessage } from "@/lib/errorMessages";

function JobRow({ job }: { readonly job: AdminJobDefinition }) {
  const mutation = useMutation({
    mutationFn: () => triggerJob(job).then((r) => r.data),
    onSuccess: () => {
      toast.success(`${job.label} triggered`);
    },
    onError: (err: unknown) => {
      toast.error(toFriendlyMessage(err));
    },
  });

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{job.label}</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {job.path}
          </code>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{job.description}</p>
      </div>
      <Button
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="gap-1.5 shrink-0"
      >
        <Play className="h-3.5 w-3.5" />
        {mutation.isPending ? "Running…" : "Trigger"}
      </Button>
    </div>
  );
}

export default function AdminJobsPage() {
  const jobs = listAdminJobs();
  return (
    <div>
      <PageHeader
        title="Background Jobs"
        subtitle="Manually trigger queued admin jobs. Available to platform admins only."
      />
      <SectionCard title="Available jobs">
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobRow key={job.name} job={job} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
