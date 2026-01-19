import { atom } from 'nanostores';

const initialFavoriteCount = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('favoriteCount') || '0')
    : 0;

export const favoriteCount = atom(initialFavoriteCount);

export function setFavoriteCount(count: number) {
    favoriteCount.set(count);
}

if (typeof window !== 'undefined') {
    favoriteCount.subscribe((count) => {
        localStorage.setItem('favoriteCount', count.toString());
    });
}

export function incrementFavoriteCount() {
    favoriteCount.set(favoriteCount.get() + 1);
}

export function decrementFavoriteCount() {
    favoriteCount.set(Math.max(0, favoriteCount.get() - 1));
}

export function clearFavorites() {
    favoriteCount.set(0);
}
