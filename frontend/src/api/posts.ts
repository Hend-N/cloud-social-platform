export interface Post {
  id?: number;
  post_id?: number;
  user_id?: number;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  content: string;
  created_at?: string;
}

export async function getPosts(): Promise<Post[]> {
  const res = await fetch("/posts");
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}
export async function getUserPosts(username: string): Promise<Post[]> {
  const res = await fetch(`/posts/user/${username}`);
  if (!res.ok) {
    const allPosts = await getPosts();
    return allPosts.filter(
      (post) => post.username?.toLowerCase() === username.toLowerCase()
    );
  }
  return res.json();
}
export const getPostsByUser = getUserPosts;

export async function deletePost(postId: number): Promise<void> {
  const token = localStorage.getItem("token"); 

  const res = await fetch(`/posts/${postId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData.detail || errorData.message || "Failed to delete post.";
    throw new Error(message);
  }
}

export async function createPost(content: string): Promise<Post> {
  const token = localStorage.getItem("token");

  const res = await fetch("/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData.detail || errorData.message || "Failed to create post.";
    throw new Error(message);
  }

  return res.json();
}