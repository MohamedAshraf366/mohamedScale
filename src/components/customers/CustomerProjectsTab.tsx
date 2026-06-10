import { ProjectsTable } from "./ProjectsTable";

interface CustomerProjectsTabProps {
  customerId: string;
  customerName?: string;
}

export function CustomerProjectsTab({ customerId, customerName = "Customer" }: CustomerProjectsTabProps) {
  return (
    <ProjectsTable 
      customerId={customerId} 
      customerName={customerName} 
    />
  );
}
