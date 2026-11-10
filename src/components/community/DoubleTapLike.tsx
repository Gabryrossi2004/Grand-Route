"use client";

import { useRef, useState } from "react";
import { Heart } from "lucide-react";
import { likePost, unlikePost } from "@/app/dashboard/community/actions";

export default function DoubleTapLike({
  postId,
  initialLiked,
  initialCount,
  children,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  children: React.ReactNode;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [showBurst, setShowBurst] = useState(false);
  const lastTapRef = useRef(0);

  function like() {
    if (liked) return;
    setLiked(true);
    setCount((c) => c + 1);
    likePost(postId);
  }

  function toggle() {
    if (liked) {
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
      unlikePost(postId);
    } else {
      like();
    }
  }

  function burst() {
    setShowBurst(true);
    setTimeout(() => setShowBurst(false), 700);
  }

  // onDoubleClick copre sia il doppio click desktop sia il doppio tap su
  // mobile (i browser lo generano anche dai gesti touch): tocco singolo non
  // fa nulla qui, solo il bottone sotto il post gestisce il toggle.
  function handleDoubleClick() {
    like();
    burst();
  }

  return (
    <div className="flex flex-col gap-2">
      <div onDoubleClick={handleDoubleClick} className="touch-manipulation select-none">
        {children}
        {showBurst && (
          <div className="pointer-events-none relative">
            <Heart
              size={64}
              className="absolute left-1/2 top-1/2 -mt-24 -translate-x-1/2 -translate-y-1/2 fill-red-500 text-red-500 drop-shadow-lg"
              style={{ animation: "community-heart-burst 0.7s ease-out" }}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggle}
        className="flex w-fit items-center gap-1.5 text-sm text-slate-500 transition hover:text-red-500"
      >
        <Heart size={16} className={liked ? "fill-red-500 text-red-500" : ""} />
        {count > 0 ? count : "Mi piace"}
      </button>

      <style jsx>{`
        @keyframes community-heart-burst {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
          30% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.15);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
