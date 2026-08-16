/**
 * Local-only persistence. Everything lives on this device: the "home page" is
 * the set of posts made here. All mutations write through to AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const PROFILE_KEY = 'colorclaim/profile/v1';
const POSTS_KEY = 'colorclaim/posts/v1';

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
  /** Absent on the seeded sample posts, which render as a solid color block. */
  photoUri?: string;
  /** Width / height, so the feed can reserve the right space before load. */
  photoAspect?: number;
  /** Normalized (0–1) spot within the photo the color was picked from. */
  pickPoint?: { u: number; v: number };
  /** One claim per post — the picker only ever lets you pull one color per photo. */
  swatch: Swatch;
  caption: string;
  createdAt: number;
  likedBy: string[];
  isSample?: boolean;
};

export type Profile = {
  id: string;
  name: string;
  saved: Swatch[];
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ------------------------------------------------------------------ *
 * Photo persistence
 * ------------------------------------------------------------------ */

/**
 * The picker hands back a URI in the cache directory, which the OS is free to
 * evict. Copy into documents so posts don't lose their photo. Falls back to the
 * original URI if the copy fails — a post with a fragile photo beats no post.
 */
async function persistPhoto(uri: string, id: string): Promise<string> {
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create({ intermediates: true });

    const extension = uri.split('?')[0].split('.').pop();
    const safeExtension = extension && extension.length <= 4 ? extension : 'jpg';

    const dest = new File(dir, `${id}.${safeExtension}`);
    if (dest.exists) dest.delete();

    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

async function deletePhoto(uri?: string) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort — a stranded file is not worth surfacing to the user.
  }
}

/* ------------------------------------------------------------------ *
 * Migration
 * ------------------------------------------------------------------ */

/**
 * Posts saved before "one color per photo" carried a `swatches` array.
 * Migrate those on load — keep the first color (the one the claim would now
 * be) rather than silently dropping someone's existing posts.
 */
function migratePost(raw: unknown): Post | null {
  if (!raw || typeof raw !== 'object') return null;
  const post = raw as Record<string, unknown>;

  if (post.swatch) return post as unknown as Post;

  if (Array.isArray(post.swatches) && post.swatches.length > 0) {
    const { swatches, ...rest } = post;
    return { ...rest, swatch: swatches[0] } as unknown as Post;
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Seed data
 * ------------------------------------------------------------------ */

const swatch = (name: string, hex: string, ageMinutes: number): Swatch => ({
  id: newId(),
  name,
  hex,
  createdAt: Date.now() - ageMinutes * 60_000,
});

function sampleFeed(): Post[] {
  return [
    {
      id: newId(),
      authorId: 'sample-1',
      authorName: 'Mika',
      swatch: swatch('Terracotta Roof', '#C4653A', 180),
      caption: 'Alley wall, late afternoon.',
      createdAt: Date.now() - 180 * 60_000,
      likedBy: [],
      isSample: true,
    },
    {
      id: newId(),
      authorId: 'sample-2',
      authorName: 'Devan',
      swatch: swatch('Pool Tile', '#2E9CB8', 620),
      caption: 'This exact blue, off the deep end of the pool.',
      createdAt: Date.now() - 620 * 60_000,
      likedBy: [],
      isSample: true,
    },
    {
      id: newId(),
      authorId: 'sample-3',
      authorName: 'Rosa',
      swatch: swatch('Overripe Plum', '#5C2A4E', 1500),
      caption: 'Market haul, the one plum that went too far.',
      createdAt: Date.now() - 1500 * 60_000,
      likedBy: [],
      isSample: true,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

export type Store = {
  ready: boolean;
  profile: Profile;
  posts: Post[];
  myPosts: Post[];
  hasSamples: boolean;

  renameProfile(name: string): void;
  saveSwatch(swatch: Swatch): void;
  removeSaved(id: string): void;
  renameSaved(id: string, name: string): void;
  publish(input: {
    photoUri?: string;
    photoAspect?: number;
    pickPoint?: { u: number; v: number };
    swatch: Swatch;
    caption: string;
  }): Promise<void>;
  toggleLike(postId: string): void;
  deletePost(postId: string): void;
  removeSamples(): void;
};

export function useStoreState(): Store {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>({ id: '', name: 'You', saved: [] });
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [rawProfile, rawPosts] = await AsyncStorage.multiGet([PROFILE_KEY, POSTS_KEY]);
        if (cancelled) return;

        const storedProfile: Profile | null = rawProfile[1] ? JSON.parse(rawProfile[1]) : null;
        setProfile(storedProfile ?? { id: newId(), name: 'You', saved: [] });

        // First launch seeds a few posts so the feed demonstrates itself.
        if (rawPosts[1]) {
          const parsed: unknown[] = JSON.parse(rawPosts[1]);
          setPosts(parsed.map(migratePost).filter((p): p is Post => p !== null));
        } else {
          setPosts(sampleFeed());
        }
      } catch {
        setProfile({ id: newId(), name: 'You', saved: [] });
        setPosts(sampleFeed());
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after hydration. Guarding on `ready` avoids clobbering stored data
  // with the empty initial state.
  useEffect(() => {
    if (ready) AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)).catch(() => {});
  }, [ready, profile]);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(POSTS_KEY, JSON.stringify(posts)).catch(() => {});
  }, [ready, posts]);

  const renameProfile = useCallback((name: string) => {
    const trimmed = name.trim() || 'You';
    setProfile((p) => ({ ...p, name: trimmed }));
    setPosts((all) => all.map((p) => (p.isSample ? p : { ...p, authorName: trimmed })));
  }, []);

  const saveSwatch = useCallback((swatch: Swatch) => {
    setProfile((p) => ({
      // Same color saved twice is almost always a re-pick, so keep the newest.
      ...p,
      saved: [swatch, ...p.saved.filter((s) => s.hex !== swatch.hex)],
    }));
  }, []);

  const removeSaved = useCallback((id: string) => {
    setProfile((p) => ({ ...p, saved: p.saved.filter((s) => s.id !== id) }));
  }, []);

  const renameSaved = useCallback((id: string, name: string) => {
    setProfile((p) => ({
      ...p,
      saved: p.saved.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)),
    }));
  }, []);

  const publish = useCallback<Store['publish']>(
    async ({ photoUri, photoAspect, pickPoint, swatch, caption }) => {
      const id = newId();
      const stored = photoUri ? await persistPhoto(photoUri, id) : undefined;

      setPosts((all) => [
        {
          id,
          authorId: profile.id,
          authorName: profile.name,
          photoUri: stored,
          photoAspect,
          pickPoint,
          swatch,
          caption: caption.trim(),
          createdAt: Date.now(),
          likedBy: [],
        },
        ...all,
      ]);
    },
    [profile.id, profile.name]
  );

  const toggleLike = useCallback(
    (postId: string) => {
      setPosts((all) =>
        all.map((p) => {
          if (p.id !== postId) return p;
          const liked = p.likedBy.includes(profile.id);
          return {
            ...p,
            likedBy: liked ? p.likedBy.filter((u) => u !== profile.id) : [...p.likedBy, profile.id],
          };
        })
      );
    },
    [profile.id]
  );

  const deletePost = useCallback((postId: string) => {
    setPosts((all) => {
      const target = all.find((p) => p.id === postId);
      void deletePhoto(target?.photoUri);
      return all.filter((p) => p.id !== postId);
    });
  }, []);

  const removeSamples = useCallback(() => {
    setPosts((all) => all.filter((p) => !p.isSample));
  }, []);

  const myPosts = useMemo(
    () => posts.filter((p) => p.authorId === profile.id),
    [posts, profile.id]
  );
  const hasSamples = useMemo(() => posts.some((p) => p.isSample), [posts]);

  return {
    ready,
    profile,
    posts,
    myPosts,
    hasSamples,
    renameProfile,
    saveSwatch,
    removeSaved,
    renameSaved,
    publish,
    toggleLike,
    deletePost,
    removeSamples,
  };
}

const StoreContext = createContext<Store | null>(null);

export const StoreProvider = StoreContext.Provider;

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
