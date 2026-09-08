import { useState } from "react";
import { updateMyProfile, uploadMyAvatar } from "../../api/users";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";
import type { Profile } from "../../types/user";
export function EditProfile({
  profile,
  onSaved,
  onCancel,
}: {
  profile: Profile;
  onSaved: (p: Profile) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(profile.display_name || ""),
    [bio, setBio] = useState(profile.bio || ""),
    [file, setFile] = useState<File>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let p = await updateMyProfile({
        display_name: name.trim(),
        bio: bio.trim(),
      });
      if (file) p = await uploadMyAvatar(file);
      onSaved(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update profile.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <form className="edit-profile" onSubmit={save}>
      <Input
        label="Display name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Textarea
        label="Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={280}
      />
      <label className="field">
        <span>Avatar</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      <ErrorMessage message={error} />
      <div className="modal-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
