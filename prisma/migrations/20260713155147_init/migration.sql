-- CreateTable
CREATE TABLE "Klas" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "leerjaar" INTEGER NOT NULL,
    "schooljaar" TEXT NOT NULL,

    CONSTRAINT "Klas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leerling" (
    "id" TEXT NOT NULL,
    "voornaam" TEXT NOT NULL,
    "achternaam" TEXT NOT NULL,
    "geboortedatum" TIMESTAMP(3) NOT NULL,
    "klasId" TEXT,
    "leerjaar" INTEGER NOT NULL,
    "schooljaar" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'geen',
    "gearchiveerd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leerling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zorgprofiel" (
    "id" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    "logo" BOOLEAN NOT NULL DEFAULT false,
    "logoOmschrijving" TEXT NOT NULL DEFAULT '',
    "leersteun" BOOLEAN NOT NULL DEFAULT false,
    "leersteunUren" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leersteunType" TEXT NOT NULL DEFAULT '',
    "zorgmaatregelen" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zorgprofiel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnose" (
    "id" TEXT NOT NULL,
    "zorgprofielId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "bron" TEXT NOT NULL,

    CONSTRAINT "Diagnose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AviResultaat" (
    "id" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    "toetsmoment" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "leestijdSeconden" INTEGER NOT NULL,
    "fouten" INTEGER NOT NULL,
    "aviNiveau" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AviResultaat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AviNormtabel" (
    "id" TEXT NOT NULL,
    "leerjaar" INTEGER NOT NULL,
    "periode" TEXT NOT NULL,
    "aviNiveau" TEXT NOT NULL,
    "tijdsgrens" INTEGER NOT NULL,
    "foutengrens" INTEGER NOT NULL,

    CONSTRAINT "AviNormtabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actie" (
    "id" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "tekst" TEXT NOT NULL,
    "opvolgdatum" TIMESTAMP(3),
    "auteur" TEXT NOT NULL DEFAULT '',
    "afgerond" BOOLEAN NOT NULL DEFAULT false,
    "afgerondOp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verslag" (
    "id" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aanwezigen" TEXT NOT NULL DEFAULT '',
    "brontekst" TEXT NOT NULL,
    "gegenereerdVerslag" TEXT NOT NULL DEFAULT '',
    "actiepunten" TEXT NOT NULL DEFAULT '',
    "opvolgdatum" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verslag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Klas_naam_schooljaar_key" ON "Klas"("naam", "schooljaar");

-- CreateIndex
CREATE UNIQUE INDEX "Zorgprofiel_leerlingId_key" ON "Zorgprofiel"("leerlingId");

-- CreateIndex
CREATE UNIQUE INDEX "AviNormtabel_leerjaar_periode_key" ON "AviNormtabel"("leerjaar", "periode");

-- AddForeignKey
ALTER TABLE "Leerling" ADD CONSTRAINT "Leerling_klasId_fkey" FOREIGN KEY ("klasId") REFERENCES "Klas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zorgprofiel" ADD CONSTRAINT "Zorgprofiel_leerlingId_fkey" FOREIGN KEY ("leerlingId") REFERENCES "Leerling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnose" ADD CONSTRAINT "Diagnose_zorgprofielId_fkey" FOREIGN KEY ("zorgprofielId") REFERENCES "Zorgprofiel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AviResultaat" ADD CONSTRAINT "AviResultaat_leerlingId_fkey" FOREIGN KEY ("leerlingId") REFERENCES "Leerling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actie" ADD CONSTRAINT "Actie_leerlingId_fkey" FOREIGN KEY ("leerlingId") REFERENCES "Leerling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verslag" ADD CONSTRAINT "Verslag_leerlingId_fkey" FOREIGN KEY ("leerlingId") REFERENCES "Leerling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
