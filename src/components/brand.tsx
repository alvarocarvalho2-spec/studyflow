import Link from "next/link";
import Image from "next/image";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link aria-label="StudyFlow, página inicial" className="brand" href={href}>
      <span aria-hidden="true" className="brand-logo-window">
        <Image
          alt=""
          className="brand-logo-image brand-logo-image-light"
          height={156}
          sizes="(max-width: 640px) 132px, 155px"
          src="/brand/studyflow-logo-v3-transparent.png"
          width={156}
        />
        <Image
          alt=""
          className="brand-logo-image brand-logo-image-dark"
          height={156}
          sizes="(max-width: 640px) 132px, 155px"
          src="/brand/studyflow-logo-v3-dark-transparent.png"
          width={156}
        />
      </span>
    </Link>
  );
}
