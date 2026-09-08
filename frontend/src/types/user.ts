export interface User {
  id?: number;
  username?: string;
  email?: string;
}
export interface Profile {
  id?: number;
  user_id?: number;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}
export interface ProfileCreate {
  username: string;
  display_name: string;
  bio?: string;
}
