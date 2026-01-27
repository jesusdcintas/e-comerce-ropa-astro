import { atom } from 'nanostores';

export type ModalType = 'info' | 'alert' | 'confirm' | 'delete' | 'prompt';

export interface ModalState {
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: (value?: string) => void;
    onCancel?: () => void;
    defaultValue?: string;
}

const initialModal: ModalState = {
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar'
};

export const modalStore = atom<ModalState>(initialModal);

export const showModal = (config: Omit<ModalState, 'isOpen'>) => {
    modalStore.set({
        ...config,
        isOpen: true,
        confirmText: config.confirmText || (config.type === 'delete' ? 'Eliminar' : 'Aceptar'),
        cancelText: config.cancelText || 'Cancelar'
    });
};

export const closeModal = () => {
    const current = modalStore.get();
    if (current.onCancel) current.onCancel();
    modalStore.set({ ...current, isOpen: false });
};

export const confirmModal = (value?: string) => {
    const current = modalStore.get();
    if (current.onConfirm) current.onConfirm(value);
    modalStore.set({ ...current, isOpen: false });
};

// Exponer globalmente para uso en scripts de Astro y HTML puro
if (typeof window !== 'undefined') {
    (window as any).showCustomModal = showModal;
    (window as any).closeCustomModal = closeModal;
    (window as any).confirmCustomModal = confirmModal;
}
