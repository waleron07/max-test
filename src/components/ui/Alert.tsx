import styles from './Alert.module.css';

type AlertProps = {
  kind?: 'error' | 'info';
  children: React.ReactNode;
};

export function Alert({ kind = 'error', children }: AlertProps) {
  return (
    <p className={`${styles.alert} ${styles[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
