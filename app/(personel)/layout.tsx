import { StaffShell } from '@/components/shell';
import { RouteGuard } from '@/components/route-guard';
export default function StaffLayout({ children }: { children: React.ReactNode }) { return <StaffShell><RouteGuard>{children}</RouteGuard></StaffShell> }
