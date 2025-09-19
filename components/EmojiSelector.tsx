import React, { useState, useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";
import { BsEmojiSmile } from "react-icons/bs";

interface Props {
  setter: React.Dispatch<React.SetStateAction<string>>;
}

export default function EmojiButton({ setter }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleEmojiClick = (emojiData: any) => {
    setter((old) => old + emojiData.emoji);
    setShowPicker(false);
  };

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block" >
      <button
        type="button"
        onClick={() => setShowPicker((prev) => !prev)}
        className="text-gray-600 hover:text-gray-700"
        aria-label="Toggle emoji picker"
      >
        <BsEmojiSmile size={18} />
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full mb-2 left-0 z-50 shadow-xl rounded-xl"
        >
          <EmojiPicker onEmojiClick={handleEmojiClick} />
        </div>
      )}
    </div>
  );
}
