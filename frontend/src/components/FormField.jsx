const FormField = ({ label, type = 'text', value, onChange, placeholder, autoComplete }) => {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-zinc-300">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
    </label>
  );
};

export default FormField;

