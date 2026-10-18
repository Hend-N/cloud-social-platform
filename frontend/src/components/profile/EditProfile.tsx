import { useState } from "react";
import type { Profile } from "../../types/user";
import { updateMyProfile, uploadMyAvatar } from "../../api/users";
import { getApiErrorMessage } from "../../api/errors";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";
export function EditProfile({
  profile,
  onSaved,
  onCancel,
}: {
  profile: Profile;
  onSaved: (p: Profile) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let updated = await updateMyProfile({ display_name: displayName, bio });
      if (avatar) {
        updated = await uploadMyAvatar(avatar);
      }
      onSaved(updated);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not update your profile."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="edit-profile" onSubmit={submit}>
      <Input
        label="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />
      <Textarea
        label="Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={200}
      />
      <label className="field">
        <span>Avatar</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
        />
      </label>
      <ErrorMessage message={error} />
      <div className="modal-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save
        </Button>
      </div>
    </form>
  );
}
