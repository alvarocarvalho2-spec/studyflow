import Link from "next/link";
import Image from "next/image";
import { GraduationCap } from "lucide-react";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link aria-label="StudyFlow, página inicial" className="brand" href={href}>
      <span aria-hidden="true" className="brand-logo-window">
        <Image
          alt=""
          className="brand-logo-image"
          height={156}
          sizes="(max-width: 640px) 132px, 155px"
          src="/brand/studyflow-logo-v3-vertical.png"
          width={156}
        />
      </span>
      <span aria-hidden="true" className="brand-fallback">
        <span className="brand-mark"><GraduationCap size={21} strokeWidth={2.25} /></span>
        <span>studyflow<span className="brand-period">.</span></span>
      </span>
    </Link>
  );
}
