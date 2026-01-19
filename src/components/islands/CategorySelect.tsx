import React, { useState, useRef, useEffect } from 'react';

interface Category {
    id: number;
    name: string;
    sizeSystem: string;
}

interface Props {
    categories: Category[];
}

export default function CategorySelect({ categories }: Props) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Cargar categoría inicial desde el input hidden (para edición)
    useEffect(() => {
        const initialCategoryId = document.getElementById('initial-category') as HTMLInputElement;
        if (initialCategoryId && initialCategoryId.value) {
            const catId = parseInt(initialCategoryId.value, 10);
            const initialCat = categories.find(c => c.id === catId);
            if (initialCat) {
                setSelectedCategory(initialCat);
            }
        }
    }, [categories]);

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (category: Category) => {
        setSelectedCategory(category);
        setSearch('');
        setIsOpen(false);
        
        // Disparar evento personalizado
        const event = new CustomEvent('categoryChanged', { 
            detail: { categoryId: category.id.toString(), sizeSystem: category.sizeSystem } 
        });
        window.dispatchEvent(event);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <input type="hidden" name="category_id" id="category_id" value={selectedCategory?.id ?? ''} />
            
            <div className="relative">
                <input
                    type="text"
                    value={isOpen ? search : (selectedCategory?.name || '')}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Buscar categoría..."
                    className="max-w-lg block w-full focus:ring-brand-gold focus:border-brand-gold sm:text-sm border-gray-300 rounded-md py-3 px-4 border bg-white"
                />
            </div>

            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {filteredCategories.length === 0 ? (
                        <div className="px-4 py-2 text-gray-500 text-sm">No se encontraron categorías</div>
                    ) : (
                        filteredCategories.map((category) => (
                            <div
                                key={category.id}
                                onClick={() => handleSelect(category)}
                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-brand-gold hover:text-white transition-colors"
                            >
                                <span className="block truncate">{category.name}</span>
                                <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                                    <span className="text-xs opacity-60">
                                        {category.sizeSystem === 'ropa' ? 'XS-XXL' : category.sizeSystem === 'calzado' ? '38-48' : category.sizeSystem === 'cinturones' ? '75-120 cm' : 'Única'}
                                    </span>
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {selectedCategory && (
                <p className="mt-1 text-xs text-gray-500">
                    Sistema: <span className="font-medium">
                        {selectedCategory.sizeSystem === 'ropa' ? 'Ropa (XS-XXL)' : 
                         selectedCategory.sizeSystem === 'calzado' ? 'Calzado (38-48)' : 'Talla Única'}
                    </span>
                </p>
            )}
        </div>
    );
}
