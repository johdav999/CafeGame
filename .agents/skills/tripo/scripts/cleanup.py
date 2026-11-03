"""Launch a separate factory-startup Blender process for static model cleanup."""
import math
import os
from pathlib import Path
import shutil
import subprocess
from credentials import within


def add_options(parser):
    parser.add_argument('--clean-output', help='After generation/resume, clean to this separate GLB')
    parser.add_argument('--blender', default=os.environ.get('BLENDER_EXE', 'blender'))
    parser.add_argument('--height', type=float, help='Set overall height in metres; omitted preserves scale')
    parser.add_argument('--merge-distance', type=float, default=0, help='Opt-in weld distance in source units')
    parser.add_argument('--decimate-ratio', type=float, default=1, help='Opt-in reduction ratio (0, 1]')
    parser.add_argument('--cleanup-timeout', type=float, default=600)


def validate_cleanup(root, source, destination, args):
    source = within(root, source)
    destination = within(root, destination)
    if any(p in {'.git', '.secrets', '.agents', '.codex'} for p in destination.relative_to(root).parts):
        raise ValueError('Cleanup output cannot be in configuration directories')
    if source.suffix.lower() not in {'.glb', '.fbx'} or destination.suffix.lower() != '.glb':
        raise ValueError('Cleanup accepts GLB/FBX and writes a separate GLB')
    if source == destination or destination.exists() or destination.with_suffix('.glb.qa.json').exists():
        raise ValueError('Cleanup destination/report already exists or would overwrite the input')
    for value in (args.merge_distance, args.decimate_ratio, args.cleanup_timeout):
        if not math.isfinite(value):
            raise ValueError('Cleanup numbers must be finite')
    if args.height is not None and (not math.isfinite(args.height) or args.height <= 0):
        raise ValueError('Height must be finite and positive')
    if args.merge_distance < 0 or not 0 < args.decimate_ratio <= 1 or args.cleanup_timeout <= 0:
        raise ValueError('Invalid cleanup distance, ratio or timeout')
    executable = shutil.which(args.blender)
    if not executable:
        raise ValueError('Blender not found; set --blender or BLENDER_EXE')
    return source, destination, executable


def run_cleanup(root, source, destination, args):
    source, destination, executable = validate_cleanup(root, source, destination, args)
    if not source.is_file():
        raise ValueError('Cleanup input file missing')
    destination.parent.mkdir(parents=True, exist_ok=True)
    command = [executable, '--background', '--factory-startup', '--python-exit-code', '1',
               '--python', str(Path(__file__).with_name('blender_cleanup.py')), '--',
               '--input', str(source), '--output', str(destination),
               '--merge-distance', str(args.merge_distance), '--decimate-ratio', str(args.decimate_ratio)]
    if args.height is not None:
        command += ['--height', str(args.height)]
    # Blender does not need provider credentials, even when invoked after generation.
    environment = dict(os.environ)
    environment.pop('TRIPO_API_KEY', None)
    subprocess.run(command, env=environment, check=True, timeout=args.cleanup_timeout)
    if not destination.is_file() or not destination.with_suffix('.glb.qa.json').is_file():
        raise ValueError('Blender did not produce both the model and QA report')
    print(f'Cleaned model: {destination}')
