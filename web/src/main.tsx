import './styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
	redirect,
} from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, api, type Range } from './api';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LinkPage } from './pages/LinkPage';
import { LinksPage } from './pages/LinksPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
			refetchOnWindowFocus: false,
		},
	},
});

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
	component: Outlet,
});

const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/login',
	validateSearch: (search: Record<string, unknown>) => ({
		error: typeof search.error === 'string' ? search.error : undefined,
	}),
	component: LoginPage,
});

const appRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'app',
	beforeLoad: async ({ context }) => {
		try {
			const me = await context.queryClient.ensureQueryData({ queryKey: ['me'], queryFn: api.me });
			return { me };
		} catch (error) {
			if (error instanceof ApiError && error.status === 401)
				throw redirect({ to: '/login', search: { error: undefined } });
			throw error;
		}
	},
	component: AppLayout,
});

const RANGES: Range[] = ['7d', '30d', '90d', 'all'];
const text = (value: unknown, pattern: RegExp) =>
	typeof value === 'string' && pattern.test(value) ? value : undefined;

interface MapSearch {
	range: Range;
	country?: string;
	region?: string;
}

const mapSearch = (search: Record<string, unknown>): MapSearch => ({
	range: RANGES.includes(search.range as Range) ? (search.range as Range) : '30d',
	country: text(search.country, /^[A-Z]{2}$/),
	region: text(search.region, /^[A-Za-z0-9-]{1,10}$/),
});

const dashboardRoute = createRoute({
	getParentRoute: () => appRoute,
	path: '/',
	validateSearch: (search: Record<string, unknown>): MapSearch & { slug?: string } => ({
		...mapSearch(search),
		slug: text(search.slug, /^[a-zA-Z0-9_-]{2,32}$/),
	}),
	component: DashboardPage,
});

const linksRoute = createRoute({ getParentRoute: () => appRoute, path: '/links', component: LinksPage });

const linkRoute = createRoute({
	getParentRoute: () => appRoute,
	path: '/links/$slug',
	validateSearch: mapSearch,
	component: LinkPage,
});

const settingsRoute = createRoute({ getParentRoute: () => appRoute, path: '/settings', component: SettingsPage });

const statsRedirect = createRoute({
	getParentRoute: () => appRoute,
	path: '/stats',
	beforeLoad: () => {
		throw redirect({ to: '/', search: { range: '30d' } });
	},
});

const tokensRedirect = createRoute({
	getParentRoute: () => appRoute,
	path: '/tokens',
	beforeLoad: () => {
		throw redirect({ to: '/settings' });
	},
});

const router = createRouter({
	routeTree: rootRoute.addChildren([
		loginRoute,
		appRoute.addChildren([dashboardRoute, linksRoute, linkRoute, settingsRoute, statsRedirect, tokensRedirect]),
	]),
	context: { queryClient },
	defaultPreload: 'intent',
	defaultNotFoundComponent: NotFoundPage,
});

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

const root = document.getElementById('root');
if (root) {
	createRoot(root).render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</StrictMode>,
	);
}
