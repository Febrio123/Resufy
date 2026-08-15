import { useState } from "react";
import {
	Briefcase,
	Certificate,
	Code,
	EnvelopeSimple,
	Globe,
	GraduationCap,
	IdentificationBadge,
	ListChecks,
	Plus,
	Trash,
	User,
} from "@phosphor-icons/react";
import { SectionCard } from "../SectionCard";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { Checkbox } from "../ui/Checkbox";
import { Button } from "../ui/Button";
import { ChipsInput } from "../ChipsInput";

const EMPTY_CONTENT = {
	personalInfo: {
		fullName: "",
		email: "",
		phone: "",
		location: "",
		website: "",
		linkedinUrl: "",
	},
	profileSummary: "",
	workExperiences: [],
	educations: [],
	skills: [],
	certifications: [],
	projects: [],
	languages: [],
};

const PROFICIENCIES = ["Dasar", "Menengah", "Mahir", "Penutur Asli"];

const newWork = () => ({
	jobTitle: "",
	company: "",
	location: "",
	startDate: "",
	endDate: "",
	isCurrent: false,
	description: "",
});
const newEducation = () => ({
	degree: "",
	institution: "",
	location: "",
	startDate: "",
	endDate: "",
	gpa: "",
});
const newCertification = () => ({ name: "", issuer: "", date: "", url: "" });
const newProject = () => ({
	name: "",
	description: "",
	url: "",
	techStack: [],
});
const newLanguage = () => ({ name: "", proficiency: "" });

function FieldGroup({
	onAdd,
	addLabel,
	addIcon: Icon,
	emptyHint,
	children,
}) {
	return (
		<div className="space-y-3">
			{children.length > 0 ? (
				children
			) : (
				<p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-fg">
					{emptyHint}
				</p>
			)}
			<Button
				type="button"
				variant="secondary"
				size="sm"
				icon={Icon}
				onClick={onAdd}>
				{addLabel}
			</Button>
		</div>
	);
}

function ItemCard({ title, onRemove, children }) {
	return (
		<div className="relative space-y-3 rounded-md border border-border bg-bg/50 p-3">
			<div className="flex items-center justify-between">
				<p className="text-sm font-bold text-foreground">{title}</p>
				<button
					type="button"
					onClick={onRemove}
					aria-label={`Hapus ${title}`}
					className="grid h-9 w-9 place-items-center rounded-md text-muted-fg hover:bg-destructive/10 hover:text-destructive">
					<Trash
						size={16}
						aria-hidden
					/>
				</button>
			</div>
			{children}
		</div>
	);
}

/**
 * CvForm — editor CV lengkap (wireframe 4.4): accordion satu-section-terbuka,
 * array editor per pengalaman/pendidikan/sertifikasi/proyek/bahasa.
 * `content` adalah objek konten CV murni (tanpa id/title/status).
 */
export function CvForm({ content, onChange, disabled = false }) {
	const [openSection, setOpenSection] = useState("personal");
	const c = {
		...EMPTY_CONTENT,
		...content,
		personalInfo: {
			...EMPTY_CONTENT.personalInfo,
			...content?.personalInfo,
		},
	};

	const set = patch => onChange({ ...c, ...patch });
	const setPersonal = (key, value) =>
		set({ personalInfo: { ...c.personalInfo, [key]: value } });

	const updateItem = (key, index, patch) =>
		set({
			[key]: c[key].map((item, i) =>
				i === index ? { ...item, ...patch } : item,
			),
		});
	const removeItem = (key, index) =>
		set({ [key]: c[key].filter((_, i) => i !== index) });

	return (
		<div className="space-y-3">
			<SectionCard
				number={1}
				title="Data Pribadi"
				icon={User}
				open={openSection === "personal"}
				onToggle={() =>
					setOpenSection(openSection === "personal" ? "" : "personal")
				}>
				<Input
					label="Nama Lengkap"
					value={c.personalInfo.fullName}
					onChange={e => setPersonal("fullName", e.target.value)}
					disabled={disabled}
				/>
				<div className="grid gap-3 sm:grid-cols-2">
					<Input
						label="Email"
						type="email"
						icon={EnvelopeSimple}
						value={c.personalInfo.email}
						onChange={e => setPersonal("email", e.target.value)}
						disabled={disabled}
					/>
					<Input
						label="No. HP"
						type="tel"
						value={c.personalInfo.phone}
						onChange={e => setPersonal("phone", e.target.value)}
						disabled={disabled}
					/>
					<Input
						label="Lokasi (Kota, Provinsi)"
						value={c.personalInfo.location}
						onChange={e => setPersonal("location", e.target.value)}
						disabled={disabled}
					/>
					<Input
						label="Website / Portfolio"
						icon={Globe}
						value={c.personalInfo.website}
						onChange={e => setPersonal("website", e.target.value)}
						disabled={disabled}
					/>
				</div>
				<Input
					label="LinkedIn URL"
					icon={IdentificationBadge}
					value={c.personalInfo.linkedinUrl}
					onChange={e => setPersonal("linkedinUrl", e.target.value)}
					disabled={disabled}
				/>
			</SectionCard>

			<SectionCard
				number={2}
				title="Ringkasan Profil"
				icon={ListChecks}
				open={openSection === "summary"}
				onToggle={() =>
					setOpenSection(openSection === "summary" ? "" : "summary")
				}
				badge={
					<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-fg">
						{c.profileSummary?.length || 0}/300
					</span>
				}>
				<Textarea
					label="Ringkasan singkat yang menonjolkan keunggulanmu (maks 300 karakter)"
					rows={4}
					maxLength={300}
					value={c.profileSummary}
					onChange={e => set({ profileSummary: e.target.value })}
					disabled={disabled}
					hint="ATS-friendly: tulis sesuai kata kunci pekerjaan yang kamu lamar."
				/>
			</SectionCard>

			<SectionCard
				number={3}
				title="Pengalaman Kerja"
				icon={Briefcase}
				open={openSection === "work"}
				onToggle={() =>
					setOpenSection(openSection === "work" ? "" : "work")
				}>
				<FieldGroup
					onAdd={() =>
						set({
							workExperiences: [...c.workExperiences, newWork()],
						})
					}
					addLabel="Tambah Pengalaman"
					addIcon={Plus}
					emptyHint="Belum ada pengalaman. Tambahkan magang, kerja freelance, atau pengalaman organisasi.">
					{c.workExperiences.map((item, i) => (
						<ItemCard
							key={i}
							title={item.jobTitle || `Pengalaman ${i + 1}`}
							onRemove={() => removeItem("workExperiences", i)}>
							<div className="grid gap-3 sm:grid-cols-2">
								<Input
									label="Jabatan"
									value={item.jobTitle}
									onChange={e =>
										updateItem("workExperiences", i, {
											jobTitle: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<Input
									label="Perusahaan"
									value={item.company}
									onChange={e =>
										updateItem("workExperiences", i, {
											company: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<Input
									label="Lokasi"
									value={item.location}
									onChange={e =>
										updateItem("workExperiences", i, {
											location: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<div className="grid grid-cols-2 gap-3">
									<Input
										label="Mulai"
										type="month"
										value={item.startDate}
										onChange={e =>
											updateItem("workExperiences", i, {
												startDate: e.target.value,
											})
										}
										disabled={disabled || item.isCurrent}
									/>
									<Input
										label="Selesai"
										type="month"
										value={item.endDate}
										onChange={e =>
											updateItem("workExperiences", i, {
												endDate: e.target.value,
											})
										}
										disabled={disabled || item.isCurrent}
									/>
								</div>
							</div>
							<Checkbox
								label="Masih bekerja di sini"
								checked={Boolean(item.isCurrent)}
								onChange={e =>
									updateItem("workExperiences", i, {
										isCurrent: e.target.checked,
									})
								}
								disabled={disabled}
							/>
							<Textarea
								label="Deskripsi (pencapaian, bukan sekadar tugas)"
								rows={3}
								value={item.description}
								onChange={e =>
									updateItem("workExperiences", i, {
										description: e.target.value,
									})
								}
								disabled={disabled}
								hint="Mulai dengan kata kerja aksi + dampak terukur, mis. 'Meningkatkan konversi 20%…'"
							/>
						</ItemCard>
					))}
				</FieldGroup>
			</SectionCard>

			<SectionCard
				number={4}
				title="Pendidikan"
				icon={GraduationCap}
				open={openSection === "education"}
				onToggle={() =>
					setOpenSection(
						openSection === "education" ? "" : "education",
					)
				}>
				<FieldGroup
					onAdd={() =>
						set({ educations: [...c.educations, newEducation()] })
					}
					addLabel="Tambah Pendidikan"
					addIcon={Plus}
					emptyHint="Belum ada data pendidikan.">
					{c.educations.map((item, i) => (
						<ItemCard
							key={i}
							title={item.degree || `Pendidikan ${i + 1}`}
							onRemove={() => removeItem("educations", i)}>
							<div className="grid gap-3 sm:grid-cols-2">
								<Input
									label="Gelar / Jurusan"
									value={item.degree}
									onChange={e =>
										updateItem("educations", i, {
											degree: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<Input
									label="Institusi"
									value={item.institution}
									onChange={e =>
										updateItem("educations", i, {
											institution: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<Input
									label="Lokasi"
									value={item.location}
									onChange={e =>
										updateItem("educations", i, {
											location: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<div className="grid grid-cols-2 gap-3">
									<Input
										label="Mulai"
										type="month"
										value={item.startDate}
										onChange={e =>
											updateItem("educations", i, {
												startDate: e.target.value,
											})
										}
										disabled={disabled}
									/>
									<Input
										label="Selesai"
										type="month"
										value={item.endDate}
										onChange={e =>
											updateItem("educations", i, {
												endDate: e.target.value,
											})
										}
										disabled={disabled}
									/>
								</div>
								<Input
									label="IPK (opsional)"
									inputMode="decimal"
									value={item.gpa}
									onChange={e =>
										updateItem("educations", i, {
											gpa: e.target.value,
										})
									}
									disabled={disabled}
								/>
							</div>
						</ItemCard>
					))}
				</FieldGroup>
			</SectionCard>

			<SectionCard
				number={5}
				title="Keahlian (Skills)"
				icon={ListChecks}
				open={openSection === "skills"}
				onToggle={() =>
					setOpenSection(openSection === "skills" ? "" : "skills")
				}
				badge={
					<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-fg">
						{c.skills.length}
					</span>
				}>
				<ChipsInput
					label="Ketik skill lalu tekan Enter"
					chips={c.skills}
					onChange={skills => set({ skills })}
					disabled={disabled}
				/>
			</SectionCard>

			<SectionCard
				number={6}
				title="Sertifikasi"
				icon={Certificate}
				open={openSection === "certification"}
				onToggle={() =>
					setOpenSection(
						openSection === "certification" ? "" : "certification",
					)
				}>
				<FieldGroup
					onAdd={() =>
						set({
							certifications: [
								...c.certifications,
								newCertification(),
							],
						})
					}
					addLabel="Tambah Sertifikasi"
					addIcon={Plus}
					emptyHint="Belum ada sertifikasi.">
					{c.certifications.map((item, i) => (
						<ItemCard
							key={i}
							title={item.name || `Sertifikasi ${i + 1}`}
							onRemove={() => removeItem("certifications", i)}>
							<div className="grid gap-3 sm:grid-cols-2">
								<Input
									label="Nama Sertifikasi"
									value={item.name}
									onChange={e =>
										updateItem("certifications", i, {
											name: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<Input
									label="Penerbit"
									value={item.issuer}
									onChange={e =>
										updateItem("certifications", i, {
											issuer: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<Input
									label="Tanggal"
									type="month"
									value={item.date}
									onChange={e =>
										updateItem("certifications", i, {
											date: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<Input
									label="URL (opsional)"
									value={item.url}
									onChange={e =>
										updateItem("certifications", i, {
											url: e.target.value,
										})
									}
									disabled={disabled}
								/>
							</div>
						</ItemCard>
					))}
				</FieldGroup>
			</SectionCard>

			<SectionCard
				number={7}
				title="Proyek"
				icon={Code}
				open={openSection === "project"}
				onToggle={() =>
					setOpenSection(openSection === "project" ? "" : "project")
				}>
				<FieldGroup
					onAdd={() =>
						set({ projects: [...c.projects, newProject()] })
					}
					addLabel="Tambah Proyek"
					addIcon={Plus}
					emptyHint="Belum ada proyek.">
					{c.projects.map((item, i) => (
						<ItemCard
							key={i}
							title={item.name || `Proyek ${i + 1}`}
							onRemove={() => removeItem("projects", i)}>
							<Input
								label="Nama Proyek"
								value={item.name}
								onChange={e =>
									updateItem("projects", i, {
										name: e.target.value,
									})
								}
								disabled={disabled}
							/>
							<Textarea
								label="Deskripsi (peran, hasil, dampak)"
								rows={3}
								value={item.description}
								onChange={e =>
									updateItem("projects", i, {
										description: e.target.value,
									})
								}
								disabled={disabled}
							/>
							<Input
								label="URL (opsional)"
								value={item.url}
								onChange={e =>
									updateItem("projects", i, {
										url: e.target.value,
									})
								}
								disabled={disabled}
							/>
							<ChipsInput
								label="Tech stack"
								chips={item.techStack || []}
								onChange={techStack =>
									updateItem("projects", i, { techStack })
								}
								disabled={disabled}
							/>
						</ItemCard>
					))}
				</FieldGroup>
			</SectionCard>

			<SectionCard
				number={8}
				title="Bahasa"
				icon={Globe}
				open={openSection === "language"}
				onToggle={() =>
					setOpenSection(openSection === "language" ? "" : "language")
				}>
				<FieldGroup
					onAdd={() =>
						set({ languages: [...c.languages, newLanguage()] })
					}
					addLabel="Tambah Bahasa"
					addIcon={Plus}
					emptyHint="Belum ada bahasa.">
					{c.languages.map((item, i) => (
						<ItemCard
							key={i}
							title={item.name || `Bahasa ${i + 1}`}
							onRemove={() => removeItem("languages", i)}>
							<div className="grid gap-3 sm:grid-cols-2">
								<Input
									label="Bahasa"
									value={item.name}
									onChange={e =>
										updateItem("languages", i, {
											name: e.target.value,
										})
									}
									disabled={disabled}
								/>
								<Select
									label="Tingkat"
									value={item.proficiency}
									onChange={e =>
										updateItem("languages", i, {
											proficiency: e.target.value,
										})
									}
									disabled={disabled}
									options={PROFICIENCIES.map(p => ({
										value: p,
										label: p,
									}))}
									placeholder="Pilih tingkat…"
								/>
							</div>
						</ItemCard>
					))}
				</FieldGroup>
			</SectionCard>
		</div>
	);
}
