/**
 * Data layer backed by the Swatchy API — the source of truth is now
 * Postgres, not this device. Every mutation round-trips to the server;
 * likes and post creation update local state optimistically so the UI
 * doesn't wait on the network for feedback.
 */

import { useAuth } from '@clerk/clerk-expo';
import { Platform } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { makeApi, type Api } from './api';

export type Swatch = {
  id: string;
  name: string;
  hex: string;
  createdAt: number;
};

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  photoUri?: string;
  photoAspect?: number;
  pickPoint?: { u: number; v: number };
  swatch: Swatch;
  caption: string;
  createdAt: number;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
};

export type Profile = {
  id: string;
  name: string;
  onboarded: boolean;
  saved: Swatch[];
};

export type WeeklySlot = { slot: number; hex: string };

export type WeeklyEntry = {
  id: string;
  slot: number;
  targetHex: string;
  photoUri: string;
  photoAspect?: number;
  pickPoint?: { u: number; v: number };
  pickedHex: string;
  /** How far the photo's color came from the target, one channel at a time (0-255, lower is closer). */
  diffR: number;
  diffG: number;
  diffB: number;
  /** diffR + diffG + diffB — 0 is a perfect match. */
  score: number;
  createdAt: number;
};

export type Weekly = {
  weekKey: string;
  palette: WeeklySlot[];
  entries: WeeklyEntry[];
};

export type ArtworkColor = { name: string; hex: string };

export type Artwork = {
  id: string;
  photoUri: string;
  photoAspect?: number;
  caption: string;
  /** Snapshot of the colors picked from the user's collection at upload time. */
  colors: ArtworkColor[];
  createdAt: number;
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Attaches a filename/mime-type-appropriate part for a local photo URI. */
async function appendPhoto(form: FormData, uri: string) {
  if (Platform.OS === 'web') {
    // Native URI objects (below) aren't real Blobs, which is all web's
    // FormData/fetch accept — so on web we have to materialize one.
    const blob = await (await fetch(uri)).blob();
    form.append('photo', blob, 'photo.jpg');
    return;
  }

  const ext = /\.(\w+)$/.exec(uri.split('?')[0])?.[1]?.toLowerCase();
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';
  // RN's fetch polyfill accepts this { uri, name, type } shape in place of a Blob.
  form.append('photo', { uri, name: `photo.${ext ?? 'jpg'}`, type } as unknown as Blob);
}

function withAbsolutePhoto(post: Post, api: Api): Post {
  return post.photoUri ? { ...post, photoUri: api.resolve(post.photoUri) } : post;
}

function withAbsoluteWeeklyPhoto(entry: WeeklyEntry, api: Api): WeeklyEntry {
  return { ...entry, photoUri: api.resolve(entry.photoUri) };
}

function withAbsoluteArtworkPhoto(artwork: Artwork, api: Api): Artwork {
  return { ...artwork, photoUri: api.resolve(artwork.photoUri) };
}

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

export type Store = {
  ready: boolean;
  signedIn: boolean;
  profile: Profile;
  posts: Post[];
  myPosts: Post[];
  weekly: Weekly | null;
  artworks: Artwork[];

  renameProfile(name: string): Promise<void>;
  completeOnboarding(): Promise<void>;
  saveSwatch(swatch: Pick<Swatch, 'name' | 'hex'>): Promise<void>;
  removeSaved(id: string): Promise<void>;
  renameSaved(id: string, name: string): Promise<void>;
  publish(input: {
    photoUri?: string;
    photoAspect?: number;
    pickPoint?: { u: number; v: number };
    swatch: Pick<Swatch, 'name' | 'hex'>;
    caption: string;
  }): Promise<void>;
  toggleLike(postId: string): Promise<void>;
  deletePost(postId: string): Promise<void>;
  refresh(): Promise<void>;
  loadWeekly(): Promise<void>;
  submitWeekly(input: {
    slot: number;
    photoUri: string;
    photoAspect?: number;
    pickPoint?: { u: number; v: number };
    pickedHex: string;
  }): Promise<void>;
  loadArtworks(): Promise<void>;
  publishArtwork(input: {
    photoUri: string;
    photoAspect?: number;
    caption: string;
    colors: ArtworkColor[];
  }): Promise<void>;
  deleteArtwork(id: string): Promise<void>;
};

export function useStoreState(): Store {
  const { isSignedIn, getToken, userId } = useAuth();
  const api = useMemo(() => makeApi(() => getToken()), [getToken]);

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>({ id: '', name: 'You', onboarded: true, saved: [] });
  const [posts, setPosts] = useState<Post[]>([]);
  const [weekly, setWeekly] = useState<Weekly | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);

  const load = useCallback(async () => {
    const [me, feed] = await Promise.all([
      api.get<Profile>('/me'),
      api.get<Post[]>('/posts'),
    ]);
    setProfile(me);
    setPosts(feed.map((p) => withAbsolutePhoto(p, api)));
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    if (!isSignedIn) {
      setReady(true); // nothing to load while signed out
      return;
    }

    setReady(false);
    load()
      .catch((err) => console.error('[store] Failed to load', err))
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
    // Re-run on sign-in/out (userId flips between null and a real id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, userId]);

  const renameProfile = useCallback(
    async (name: string) => {
      const trimmed = name.trim() || 'You';
      const updated = await api.patch<{ id: string; name: string }>('/me', { name: trimmed });
      setProfile((p) => ({ ...p, name: updated.name }));
      setPosts((all) => all.map((p) => (p.mine ? { ...p, authorName: updated.name } : p)));
    },
    [api]
  );

  const completeOnboarding = useCallback(async () => {
    // Flip the UI immediately — onboarding is a one-way door, and there's
    // nothing useful to show if this PATCH is still in flight.
    setProfile((p) => ({ ...p, onboarded: true }));
    try {
      await api.patch('/me', { onboarded: true });
    } catch (err) {
      console.error('[store] Failed to persist onboarding completion', err);
      // Not rolled back on purpose — retrying the whole flow on the next
      // launch because of a flaky PATCH would be worse than a rare miss.
    }
  }, [api]);

  const saveSwatch = useCallback(
    async (swatch: Pick<Swatch, 'name' | 'hex'>) => {
      const saved = await api.post<Swatch>('/swatches', swatch);
      setProfile((p) => ({
        ...p,
        saved: [saved, ...p.saved.filter((s) => s.hex !== saved.hex)],
      }));
    },
    [api]
  );

  const removeSaved = useCallback(
    async (id: string) => {
      await api.del(`/swatches/${id}`);
      setProfile((p) => ({ ...p, saved: p.saved.filter((s) => s.id !== id) }));
    },
    [api]
  );

  const renameSaved = useCallback(
    async (id: string, name: string) => {
      const updated = await api.patch<Swatch>(`/swatches/${id}`, { name });
      setProfile((p) => ({ ...p, saved: p.saved.map((s) => (s.id === id ? updated : s)) }));
    },
    [api]
  );

  const publish = useCallback<Store['publish']>(
    async ({ photoUri, photoAspect, pickPoint, swatch, caption }) => {
      const form = new FormData();
      form.append('swatchName', swatch.name);
      form.append('swatchHex', swatch.hex);
      form.append('caption', caption);
      if (photoAspect) form.append('photoAspect', String(photoAspect));
      if (pickPoint) {
        form.append('pickU', String(pickPoint.u));
        form.append('pickV', String(pickPoint.v));
      }
      if (photoUri) await appendPhoto(form, photoUri);

      const created = await api.post<Post>('/posts', form);
      setPosts((all) => [withAbsolutePhoto(created, api), ...all]);
    },
    [api]
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      const target = posts.find((p) => p.id === postId);
      if (!target) return;
      const wasLiked = target.likedByMe;

      // Optimistic — liking should feel instant.
      setPosts((all) =>
        all.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: !wasLiked, likeCount: p.likeCount + (wasLiked ? -1 : 1) }
            : p
        )
      );

      try {
        if (wasLiked) await api.del(`/posts/${postId}/like`);
        else await api.post(`/posts/${postId}/like`);
      } catch (err) {
        console.error('[store] Failed to toggle like', err);
        // Roll back on failure.
        setPosts((all) =>
          all.map((p) =>
            p.id === postId
              ? { ...p, likedByMe: wasLiked, likeCount: p.likeCount + (wasLiked ? 1 : -1) }
              : p
          )
        );
      }
    },
    [api, posts]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      await api.del(`/posts/${postId}`);
      setPosts((all) => all.filter((p) => p.id !== postId));
    },
    [api]
  );

  const loadWeekly = useCallback(async () => {
    const data = await api.get<Weekly>('/weekly');
    setWeekly({ ...data, entries: data.entries.map((e) => withAbsoluteWeeklyPhoto(e, api)) });
  }, [api]);

  const submitWeekly = useCallback<Store['submitWeekly']>(
    async ({ slot, photoUri, photoAspect, pickPoint, pickedHex }) => {
      const form = new FormData();
      form.append('pickedHex', pickedHex);
      if (photoAspect) form.append('photoAspect', String(photoAspect));
      if (pickPoint) {
        form.append('pickU', String(pickPoint.u));
        form.append('pickV', String(pickPoint.v));
      }
      await appendPhoto(form, photoUri);

      const entry = await api.post<WeeklyEntry>(`/weekly/${slot}`, form);
      setWeekly((w) =>
        w
          ? { ...w, entries: [...w.entries.filter((e) => e.slot !== slot), withAbsoluteWeeklyPhoto(entry, api)] }
          : w
      );
    },
    [api]
  );

  const loadArtworks = useCallback(async () => {
    const data = await api.get<Artwork[]>('/artworks');
    setArtworks(data.map((a) => withAbsoluteArtworkPhoto(a, api)));
  }, [api]);

  const publishArtwork = useCallback<Store['publishArtwork']>(
    async ({ photoUri, photoAspect, caption, colors }) => {
      const form = new FormData();
      form.append('caption', caption);
      form.append('colors', JSON.stringify(colors));
      if (photoAspect) form.append('photoAspect', String(photoAspect));
      await appendPhoto(form, photoUri);

      const created = await api.post<Artwork>('/artworks', form);
      setArtworks((all) => [withAbsoluteArtworkPhoto(created, api), ...all]);
    },
    [api]
  );

  const deleteArtwork = useCallback(
    async (id: string) => {
      await api.del(`/artworks/${id}`);
      setArtworks((all) => all.filter((a) => a.id !== id));
    },
    [api]
  );

  const myPosts = useMemo(() => posts.filter((p) => p.mine), [posts]);

  return {
    ready,
    signedIn: !!isSignedIn,
    profile,
    posts,
    myPosts,
    weekly,
    artworks,
    renameProfile,
    completeOnboarding,
    saveSwatch,
    removeSaved,
    renameSaved,
    publish,
    toggleLike,
    deletePost,
    refresh: load,
    loadWeekly,
    submitWeekly,
    loadArtworks,
    publishArtwork,
    deleteArtwork,
  };
}

const StoreContext = createContext<Store | null>(null);

export const StoreProvider = StoreContext.Provider;

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
