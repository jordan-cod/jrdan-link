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
import { ApiError, api } from './api';
import { AppLayout } from './components/AppLayout';
import { LinksPage } from './pages/LinksPage';
import { LoginPage } from './pages/LoginPage';
import { TokensPage } from './pages/TokensPage';

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

const linksRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: LinksPage });
const tokensRoute = createRoute({ getParentRoute: () => appRoute, path: '/tokens', component: TokensPage });

const router = createRouter({
	routeTree: rootRoute.addChildren([loginRoute, appRoute.addChildren([linksRoute, tokensRoute])]),
	context: { queryClient },
	defaultPreload: 'intent',
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
