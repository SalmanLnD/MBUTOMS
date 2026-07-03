import mongoose from 'mongoose';

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'app_settings' }
);

const AppSetting = mongoose.model('AppSetting', appSettingSchema);
export default AppSetting;
