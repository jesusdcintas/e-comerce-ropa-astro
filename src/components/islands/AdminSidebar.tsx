import React, { useState } from 'react';

interface Category {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
}

interface Props {
    categories: Category[];
    pendingCount?: number;
    currentPath?: string;
    currentCategory?: string | null;
}

export default function AdminSidebar({ categories, pendingCount = 0, currentPath = '', currentCategory = null }: Props) {
    const [isProductsOpen, setIsProductsOpen] = useState(currentPath.startsWith('/admin/products'));
    const [openCategories, setOpenCategories] = useState<number[]>([]);
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    React.useEffect(() => {
        // Cargar estado inicial
        const initial = localStorage.getItem('admin-sidebar-collapsed') === 'true';
        setIsCollapsed(initial);

        const handleToggle = (e: any) => {
            const collapsed = e.detail.collapsed;
            setIsCollapsed(collapsed);
            if (collapsed) {
                setIsProductsOpen(false);
                setOpenCategories([]);
            }
        };

        window.addEventListener('sidebar-toggle', handleToggle);
        return () => window.removeEventListener('sidebar-toggle', handleToggle);
    }, []);

    const mainCategories = categories.filter(cat => !cat.parent_id);
    const getSubcategories = (parentId: number) => {
        return categories.filter(cat => cat.parent_id === parentId);
    };

    const toggleCategory = (categoryId: number) => {
        if (openCategories.includes(categoryId)) {
            setOpenCategories(openCategories.filter(id => id !== categoryId));
        } else {
            setOpenCategories([...openCategories, categoryId]);
        }
    };

    const navLinkClass = "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200";
    const activeClass = "bg-white/10 text-white shadow-sm ring-1 ring-white/10";
    const inactiveClass = "text-slate-400 hover:bg-white/5 hover:text-white";

    const isActive = (path: string) => currentPath === path;
    const isActiveParent = (path: string) => currentPath.startsWith(path);

    return (
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
            {/* Dashboard */}
            <a href="/admin" className={`${navLinkClass} ${isActive('/admin') ? activeClass : inactiveClass}`} title={isCollapsed ? "Dashboard" : ""}>
                <svg className={`shrink-0 h-5 w-5 ${isActive('/admin') ? 'text-brand-gold' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="sidebar-text overflow-hidden transition-all duration-300">Dashboard</span>
            </a>

            {/* Productos con desplegable */}
            <div className="space-y-1">
                <button
                    onClick={() => setIsProductsOpen(!isProductsOpen)}
                    className={`w-full ${navLinkClass} ${!isActiveParent('/admin/products') ? inactiveClass : activeClass} justify-between`}
                    title={isCollapsed ? "Portal de Productos" : ""}
                >
                    <div className="flex items-center">
                        <svg className={`shrink-0 h-5 w-5 ${isActiveParent('/admin/products') ? 'text-brand-gold' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span className="sidebar-text overflow-hidden transition-all duration-300">Portal de Productos</span>
                    </div>
                    {!isCollapsed && (
                        <svg
                            className={`h-4 w-4 transition-transform duration-300 ${isProductsOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </button>

                {isProductsOpen && (
                    <div className="ml-9 space-y-1 border-l border-white/10 pl-2 py-1">
                        <a href="/admin/products" className={`block px-3 py-2 text-xs font-medium transition-colors ${isActive('/admin/products') ? 'text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
                            Inventario Total
                        </a>
                        <a href="/admin/products/new" className={`block px-3 py-2 text-xs font-medium transition-colors ${isActive('/admin/products/new') ? 'text-white font-bold' : 'text-brand-gold hover:text-white'}`}>
                            + Añadir Nuevo
                        </a>

                        {/* Separador */}
                        <div className="h-px bg-white/5 my-2 mx-3"></div>

                        {mainCategories.map(category => {
                            let subcategories: Category[] = [];

                            if (category.id === 1) { // ROPA: Aplanar nivel superior/inferior
                                const intermediate = categories.filter(cat => cat.parent_id === category.id);
                                subcategories = categories.filter(cat =>
                                    intermediate.some(inter => inter.id === cat.parent_id)
                                );
                            } else if (category.id === 2) { // COMPLEMENTOS: Renombrar y ajustar
                                // Obtenemos hijos de nivel 2
                                const level2 = categories.filter(cat => cat.parent_id === category.id);

                                // Mapeamos a lo que el usuario quiere
                                subcategories = level2.map(l2 => {
                                    if (l2.slug === 'cabeza') return { ...l2, name: 'Gorras y gorros' };
                                    if (l2.slug === 'bolsos-y-transporte') return { ...l2, name: 'Bolsos y mochilas' };
                                    if (l2.slug === 'joyeria-y-relojeria') return { ...l2, name: 'Joyería y relojes' };
                                    return l2;
                                }).filter(cat => cat.slug !== 'cinturones-y-gafas');

                                // Añadimos Cinturones y Gafas por separado (eran nietos)
                                const cinturonesGafas = categories.find(c => c.slug === 'cinturones-y-gafas');
                                if (cinturonesGafas) {
                                    const descendants = categories.filter(c => c.parent_id === cinturonesGafas.id);
                                    const cinturones = descendants.find(d => d.slug === 'cinturones');
                                    const gafas = descendants.find(d => d.slug === 'gafas-de-sol');
                                    if (cinturones) subcategories.push({ ...cinturones, name: 'Cinturones' });
                                    if (gafas) subcategories.push({ ...gafas, name: 'Gafas' });
                                }
                            } else {
                                subcategories = getSubcategories(category.id);
                            }

                            const hasSubcategories = subcategories.length > 0;
                            const isOpen = openCategories.includes(category.id);
                            const isSearchActive = (slug: string) => currentPath === `/admin/products` && currentCategory === slug;

                            return (
                                <div key={category.id} className="space-y-1">
                                    {hasSubcategories ? (
                                        <div className="flex items-center justify-between group/cat">
                                            <a
                                                href={`/admin/products?category=${category.slug}`}
                                                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${isSearchActive(category.slug) ? 'text-white font-bold' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                <span className="sidebar-text transition-all duration-300">{category.name}</span>
                                            </a>
                                            {!isCollapsed && (
                                                <button
                                                    onClick={() => toggleCategory(category.id)}
                                                    className="p-2 text-slate-500 hover:text-brand-gold transition-colors"
                                                >
                                                    <svg className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <a href={`/admin/products?category=${category.slug}`} className={`block px-3 py-2 text-xs font-medium transition-colors ${isSearchActive(category.slug) ? 'text-white' : 'text-slate-500 hover:text-white'}`}>
                                            <span className="sidebar-text transition-all duration-300">{category.name}</span>
                                        </a>
                                    )}

                                    {hasSubcategories && isOpen && !isCollapsed && (
                                        <div className="ml-3 space-y-1 border-l border-white/5 pl-2">
                                            {subcategories.map(subcat => (
                                                <a
                                                    key={subcat.id}
                                                    href={`/admin/products?category=${subcat.slug}`}
                                                    className={`block px-3 py-1.5 text-xs transition-colors ${isSearchActive(subcat.slug) ? 'text-brand-gold' : 'text-slate-600 hover:text-brand-gold'}`}
                                                >
                                                    <span className="sidebar-text transition-all duration-300">{subcat.name}</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pedidos */}
            <a href="/admin/orders" className={`${navLinkClass} ${isActive('/admin/orders') ? activeClass : inactiveClass}`} title={isCollapsed ? "Gestión de Pedidos" : ""}>
                <svg className={`shrink-0 h-5 w-5 ${isActive('/admin/orders') ? 'text-white' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="sidebar-text overflow-hidden transition-all duration-300">Gestión de Pedidos</span>
            </a>

            {/* Clientes */}
            <a href="/admin/clients" className={`${navLinkClass} ${isActive('/admin/clients') ? activeClass : inactiveClass}`} title={isCollapsed ? "Gestión de Clientes" : ""}>
                <svg className={`shrink-0 h-5 w-5 ${isActive('/admin/clients') ? 'text-white' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="sidebar-text overflow-hidden transition-all duration-300">Gestión de Clientes</span>
            </a>

            {/* Consultas */}
            <a href="/admin/inquiries" className={`${navLinkClass} ${isActive('/admin/inquiries') ? activeClass : inactiveClass} justify-between group`} title={isCollapsed ? "Consultas Clientes" : ""}>
                <div className="flex items-center">
                    <svg className={`shrink-0 h-5 w-5 ${isActive('/admin/inquiries') ? 'text-white' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="sidebar-text overflow-hidden transition-all duration-300">Consultas Clientes</span>
                </div>
                {pendingCount > 0 && (
                    <span className={`${isCollapsed ? 'absolute top-1 right-1' : ''} flex h-5 w-5 items-center justify-center rounded-full bg-brand-gold text-[10px] font-black text-white shadow-lg shadow-brand-gold/20 animate-bounce`}>
                        {pendingCount}
                    </span>
                )}
            </a>

            {/* Gestión de Cupones */}
            <a href="/admin/cupones" className={`${navLinkClass} ${isActive('/admin/cupones') ? activeClass : inactiveClass}`} title={isCollapsed ? "Gestión de Cupones" : ""}>
                <svg className={`shrink-0 h-5 w-5 ${isActive('/admin/cupones') ? 'text-white' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                <span className="sidebar-text overflow-hidden transition-all duration-300">Gestión de Cupones</span>
            </a>

            {/* Campañas Pop-ups */}
            <a href="/admin/popups" className={`${navLinkClass} ${isActive('/admin/popups') ? activeClass : inactiveClass}`} title={isCollapsed ? "Campañas Pop-ups" : ""}>
                <svg className={`shrink-0 h-5 w-5 ${isActive('/admin/popups') ? 'text-white' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                <span className="sidebar-text overflow-hidden transition-all duration-300">Campañas Pop-ups</span>
            </a>

            {/* Gestión de Ofertas */}
            <a href="/admin/offers" className={`${navLinkClass} ${isActive('/admin/offers') ? activeClass : inactiveClass}`} title={isCollapsed ? "Gestión de Ofertas" : ""}>
                <svg className={`shrink-0 h-5 w-5 ${isActive('/admin/offers') ? 'text-white' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="sidebar-text overflow-hidden transition-all duration-300">Gestión de Ofertas</span>
            </a>

            {/* Gestión de Novedades */}
            <a href="/admin/novedades" className={`${navLinkClass} ${isActive('/admin/novedades') ? activeClass : inactiveClass}`} title={isCollapsed ? "Gestión de Novedades" : ""}>
                <svg className={`shrink-0 h-5 w-5 ${isActive('/admin/novedades') ? 'text-white' : ''} ${!isCollapsed ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
                </svg>
                <span className="sidebar-text overflow-hidden transition-all duration-300">Gestión de Novedades</span>
            </a>

            {/* Ver Tienda Pública */}
            <div className="mt-auto pt-10">
                <a href="/" target="_blank" className="flex items-center px-4 py-3 text-xs font-semibold text-slate-500 hover:text-white border-t border-white/5 group transition-colors" title={isCollapsed ? "Ver Tienda" : ""}>
                    <span className="sidebar-text transition-all duration-300">Ver Tienda en Vivo</span>
                    <svg className={`h-4 w-4 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform ${!isCollapsed ? 'ml-2' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>
        </nav>
    );
}
