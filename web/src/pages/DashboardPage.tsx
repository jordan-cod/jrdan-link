import { useNavigate, useSearch } from '@tanstack/react-router';
import { type StatsSearch, StatsView } from '../components/StatsView';

export function DashboardPage() {
	const search = useSearch({ from: '/app/' });
	const navigate = useNavigate({ from: '/' });

	return (
		<div className="grid gap-6">
			<h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
			<StatsView
				search={search}
				onSearch={(patch: Partial<StatsSearch>) =>
					navigate({ search: (prev) => ({ ...prev, ...patch }), resetScroll: false, replace: true })
				}
			/>
		</div>
	);
}
